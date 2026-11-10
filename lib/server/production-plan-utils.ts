import type { Prisma, PrismaClient } from "@prisma/client";
import { calcJinPerPurchaseUnit } from "@/lib/shared/spec-parser";
import { formatPortions } from "@/lib/shared/weight-format";
import { getJinFactors, getGramsPerJin, getWeightUnitNames } from "@/lib/server/unit-factors";

/**
 * 切配中心生产计划单汇总计算（快照，生成时固化一次）。
 * 口径：
 * - 切配按 (sourceType, sourceId) 跨店合并，净料用量相加；切配份数 = 合并量 ÷ 封装规格 重算；
 *   毛料用量（斤）经来源原料关联到汇总采购行。
 * - 采购按 (sourceType, sourceId) 合并毛需求（克）；不做库存抵扣（库存模块改版中）；
 *   采购量按门店排程同一套取整规则重算；预估金额 = 采购口径金额。
 * - 全部字段来自基础数据档案，不拼造。
 */

export interface AggregatedCutting {
  sourceType: string;
  sourceId: number;
  sourceCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  packageSpec: number | null;
  requiredQty: number;
  unit: string;
  portions: number | null;
  portionsText: string | null;
  grossNeedJin: number | null;
}

export interface AggregatedPurchase {
  sourceType: string;
  sourceId: number;
  sourceCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  grossNeed: number; // 克
  suggestedPurchase: number; // 采购单位数量；散称按斤
  unit: string;
  purchaseSpec: string | null;
  priceUnit: string | null;
  supplierId: number | null;
  supplierName: string | null;
  estimatedAmount: number | null;
}

export interface ProductionPlanData {
  cutting: AggregatedCutting[];
  purchase: AggregatedPurchase[];
}

export async function buildProductionPlanData(
  prisma: PrismaClient | Prisma.TransactionClient,
  scheduleIds: number[]
): Promise<ProductionPlanData> {
  const [cuttingOrders, purchasePlans, jinFactors, gramsPerJin, weightUnitNames] = await Promise.all([
    prisma.cuttingOrder.findMany({ where: { scheduleId: { in: scheduleIds } } }),
    prisma.purchasePlan.findMany({ where: { scheduleId: { in: scheduleIds } } }),
    getJinFactors(prisma),
    getGramsPerJin(prisma),
    getWeightUnitNames(prisma),
  ]);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ---- 汇总采购（先做，切配的毛料用量依赖它） ----
  const pAgg = new Map<string, { sourceType: string; sourceId: number; grossNeed: number }>();
  for (const p of purchasePlans) {
    const key = p.sourceType + "-" + p.sourceId;
    const cur = pAgg.get(key);
    if (cur) cur.grossNeed += Number(p.grossNeed);
    else pAgg.set(key, { sourceType: p.sourceType, sourceId: p.sourceId, grossNeed: Number(p.grossNeed) });
  }

  const ingIds = [...pAgg.values()].filter((p) => p.sourceType !== "sauce").map((p) => p.sourceId);
  const sauceIds = [...pAgg.values()].filter((p) => p.sourceType === "sauce").map((p) => p.sourceId);
  const [ings, sauces, pL2Cats] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: ingIds } },
      select: {
        id: true, code: true, name: true, l2Code: true,
        purchaseUnit: true, purchaseSpec: true, pricePerJin: true, latestRefPrice: true,
        defaultSupplierId: true, defaultSupplier: { select: { name: true } },
      },
    }),
    prisma.sauceIngredient.findMany({
      where: { id: { in: sauceIds } },
      select: {
        id: true, code: true, name: true,
        purchaseUnit: true, purchaseSpec: true, pricePerJin: true,
        defaultSupplierId: true, defaultSupplier: { select: { name: true } },
      },
    }),
    prisma.ingredientCategoryL2.findMany({ select: { code: true, name: true, parentCode: true } }),
  ]);
  const pL1Codes = [...new Set(pL2Cats.map((c) => c.parentCode).filter((c): c is string => !!c))];
  const pL1Cats = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: pL1Codes } },
    select: { code: true, name: true },
  });

  const ingMap = new Map(ings.map((i) => [i.id, i]));
  const sauceMap = new Map(sauces.map((s) => [s.id, s]));
  const grossJinByKey = new Map<string, number>();

  const purchase: AggregatedPurchase[] = [...pAgg.values()].map((p) => {
    const grossJin = p.grossNeed / gramsPerJin; // 毛料用量（斤），不做库存抵扣
    grossJinByKey.set(p.sourceType + "-" + p.sourceId, grossJin);
    const isIngredient = p.sourceType !== "sauce";
    const row = isIngredient ? ingMap.get(p.sourceId) : sauceMap.get(p.sourceId);
    const l2Cat = row && isIngredient ? pL2Cats.find((c) => c.code === (row as { l2Code?: string }).l2Code) : null;
    const l1Cat = l2Cat ? pL1Cats.find((c) => c.code === l2Cat.parentCode) : null;
    const pricePerJin = row?.pricePerJin != null ? Number(row.pricePerJin) : null;
    const latestRefPrice = row && "latestRefPrice" in row && row.latestRefPrice != null ? Number(row.latestRefPrice) : null;

    const purchaseUnit = row?.purchaseUnit ?? null;
    const purchaseSpec = row?.purchaseSpec ?? null;
    const isWeightPurchase = !purchaseUnit || weightUnitNames.has(purchaseUnit);
    const jinPerPurchase = calcJinPerPurchaseUnit(purchaseSpec ?? "", jinFactors);

    // 与门店排程一致的取整规则（无库存抵扣）
    let suggested: number;
    let unit: string;
    if (!isWeightPurchase && purchaseUnit) {
      suggested = jinPerPurchase != null
        ? grossJin > 0
          ? Math.ceil(grossJin / jinPerPurchase - 1e-9)
          : 0
        : grossJin > 0
          ? 1
          : 0;
      unit = purchaseUnit;
    } else {
      suggested = round2(grossJin);
      unit = "斤";
    }

    const costPerPurchase =
      latestRefPrice ??
      (jinPerPurchase != null && pricePerJin != null ? round2(jinPerPurchase * pricePerJin) : null);
    const estimatedAmount = !isWeightPurchase
      ? costPerPurchase != null && suggested > 0
        ? round2(suggested * costPerPurchase)
        : null
      : pricePerJin != null && grossJin > 0
        ? round2(grossJin * pricePerJin)
        : null;

    return {
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      sourceCode: row?.code ?? "",
      itemName: row?.name ?? "",
      l1Name: l1Cat?.name || "其他",
      l2Name: l2Cat?.name || (isIngredient ? (row as { l2Code?: string }).l2Code || "—" : "—"),
      grossNeed: round2(p.grossNeed),
      suggestedPurchase: suggested,
      unit,
      purchaseSpec,
      priceUnit: unit,
      supplierId: row?.defaultSupplierId ?? null,
      supplierName: row?.defaultSupplier?.name ?? null,
      estimatedAmount,
    };
  });

  // ---- 汇总切配 ----
  const cAgg = new Map<string, { sourceType: string; sourceId: number; requiredQty: number }>();
  for (const c of cuttingOrders) {
    const key = c.sourceType + "-" + c.sourceId;
    const cur = cAgg.get(key);
    if (cur) cur.requiredQty += Number(c.requiredQty);
    else cAgg.set(key, { sourceType: c.sourceType, sourceId: c.sourceId, requiredQty: Number(c.requiredQty) });
  }
  const netIds = [...cAgg.values()].filter((c) => c.sourceType === "net").map((c) => c.sourceId);
  const minorIds = [...cAgg.values()].filter((c) => c.sourceType === "minor").map((c) => c.sourceId);
  const nets = await prisma.netIngredient.findMany({
    where: { id: { in: [...netIds, ...minorIds] } },
    select: { id: true, code: true, name: true, unit: true, packageSpec: true, l2Code: true, sourceIngredientId: true },
  });
  const netMap = new Map(nets.map((n) => [n.id, n]));
  const cL2Codes = nets.map((n) => n.l2Code).filter((x): x is string => !!x);
  const cL2Cats = await prisma.ingredientCategoryL2.findMany({ where: { code: { in: cL2Codes } }, select: { code: true, name: true, parentCode: true } });
  const cL1Codes = [...new Set(cL2Cats.map((c) => c.parentCode).filter((c): c is string => !!c))];
  const cL1Cats = await prisma.ingredientCategoryL1.findMany({ where: { code: { in: cL1Codes } }, select: { code: true, name: true } });

  const cutting: AggregatedCutting[] = [...cAgg.values()].map((c) => {
    const net = netMap.get(c.sourceId);
    const l2Cat = net ? cL2Cats.find((x) => x.code === net.l2Code) : null;
    const l1Cat = l2Cat ? cL1Cats.find((x) => x.code === l2Cat.parentCode) : null;
    const pkg = net?.packageSpec != null ? Number(net.packageSpec) : null;
    const portions = pkg && pkg > 0 ? round2(c.requiredQty / pkg) : null;
    const srcId = net?.sourceIngredientId ?? null;
    const grossNeedJin = srcId != null ? grossJinByKey.get("ingredient-" + srcId) ?? null : null;
    return {
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceCode: net?.code ?? "",
      itemName: net?.name ?? "",
      l1Name: l1Cat?.name || "其他",
      l2Name: l2Cat?.name || (net?.l2Code ?? "小料"),
      packageSpec: pkg,
      requiredQty: round2(c.requiredQty),
      unit: net?.unit ?? "g",
      portions,
      portionsText: pkg && pkg > 0 ? formatPortions(c.requiredQty, pkg) : null,
      grossNeedJin: grossNeedJin != null ? round2(grossNeedJin) : null,
    };
  });

  cutting.sort((a, b) => a.l1Name.localeCompare(b.l1Name, "zh") || a.l2Name.localeCompare(b.l2Name, "zh") || a.itemName.localeCompare(b.itemName, "zh"));
  purchase.sort((a, b) => a.l1Name.localeCompare(b.l1Name, "zh") || a.l2Name.localeCompare(b.l2Name, "zh") || a.itemName.localeCompare(b.itemName, "zh"));

  return { cutting, purchase };
}
