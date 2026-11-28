import type { Prisma, PrismaClient } from "@prisma/client";
import { calcJinPerPurchaseUnit } from "@/lib/shared/spec-parser";
import { calcGrossNeedGrams } from "@/lib/shared/gross-need";
import { formatPortions } from "@/lib/shared/weight-format";
import { getJinFactors, getGramsPerJin, getWeightUnitNames } from "@/lib/server/unit-factors";
import { ProductionPlanAssignmentError } from "@/lib/server/production-plan-assignment";
import type { PlanPortionAdjustment } from "@/lib/server/schemas/production-plan";
import {
  buildProductionPlanSourceSnapshot,
  type ProductionPlanSourceSnapshot,
} from "@/lib/shared/production-plan";

export {
  buildSourceScheduleSnapshot,
  buildProductionPlanSourceSnapshot,
  type ProductionPlanSourceSnapshot,
} from "@/lib/shared/production-plan";

/**
 * 切配中心生产计划单汇总计算（快照，生成时固化一次）。
 * 口径：
 * - 切配按 (sourceType, sourceId) 跨排程合并，净料用量相加；切配份数 = 合并量 ÷ 封装规格 重算；
 *   用户调整（adjustments）按最终份数直接覆盖/追加，毛料用量（斤）经来源原料关联到汇总采购行。
 * - 采购按 (sourceType, sourceId) 合并排程毛需求（克），再加上行级调整 delta：
 *   delta 克重 = (最终份数 − 基线份数) × 封装规格，按出成率折算原料毛需求后并入同一口径；不做库存抵扣。
 * - 手工新增行（origin=manual）与排程合并行同 key 合并，绝不允许两行同 key。
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
  origin?: "schedule" | "manual";
  originalPortions?: number | null;
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
  sourceSnapshot: ProductionPlanSourceSnapshot;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 从计划单现有 cuttingJson 行还原行级调整（规格变更自动重算时用）：
 * 排程行原样提交（delta=0），手工/自产行以原份数重新追加，保证重建后份数不丢。
 * sourceType 由服务端重新派生，跳过无份数的历史脏行。
 */
export function planAdjustmentsFromCuttingJson(cuttingJson: unknown): PlanPortionAdjustment[] {
  if (!Array.isArray(cuttingJson)) return [];
  const adjustments: PlanPortionAdjustment[] = [];
  for (const row of cuttingJson) {
    const r = row as { sourceType?: unknown; sourceId?: unknown; portions?: unknown };
    if (
      // minor 为历史快照值（小料已并入净料），仍需识别以还原旧计划的调整行
      (r.sourceType === "net" || r.sourceType === "minor") &&
      typeof r.sourceId === "number" &&
      typeof r.portions === "number" &&
      Number.isFinite(r.portions)
    ) {
      adjustments.push({ sourceId: r.sourceId, portions: round2(r.portions) });
    }
  }
  return adjustments;
}

/** 调整行的覆盖信息：key = `${sourceType}-${sourceId}` */
interface AdjustmentOverlay {
  portions: number;
  originalPortions: number | null;
  origin: "schedule" | "manual";
}

export async function buildProductionPlanData(
  prisma: PrismaClient | Prisma.TransactionClient,
  scheduleIds: number[],
  adjustments: PlanPortionAdjustment[] = []
): Promise<ProductionPlanData> {
  const [cuttingOrders, purchasePlans, sourceSchedules, jinFactors, gramsPerJin, weightUnitNames] =
    await Promise.all([
      prisma.cuttingOrder.findMany({ where: { scheduleId: { in: scheduleIds } } }),
      prisma.purchasePlan.findMany({ where: { scheduleId: { in: scheduleIds } } }),
      prisma.schedule.findMany({
        where: { id: { in: scheduleIds } },
        select: {
          id: true,
          code: true,
          title: true,
          scheduleDate: true,
          store: { select: { id: true, name: true } },
          items: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              quantity: true,
              dish: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  portion: true,
                  meatType: true,
                },
              },
            },
          },
        },
      }),
      getJinFactors(prisma),
      getGramsPerJin(prisma),
      getWeightUnitNames(prisma),
    ]);

  // ---- 汇总采购基线（排程 PurchasePlan.grossNeed 按 key 合并） ----
  const pAgg = new Map<string, { sourceType: string; sourceId: number; grossNeed: number }>();
  for (const p of purchasePlans) {
    const key = p.sourceType + "-" + p.sourceId;
    const cur = pAgg.get(key);
    if (cur) cur.grossNeed += Number(p.grossNeed);
    else pAgg.set(key, { sourceType: p.sourceType, sourceId: p.sourceId, grossNeed: Number(p.grossNeed) });
  }

  // ---- 汇总切配基线（排程 CuttingOrder.requiredQty 按 key 合并） ----
  const cAgg = new Map<string, { sourceType: string; sourceId: number; requiredQty: number }>();
  for (const c of cuttingOrders) {
    const key = c.sourceType + "-" + c.sourceId;
    const cur = cAgg.get(key);
    if (cur) cur.requiredQty += Number(c.requiredQty);
    else cAgg.set(key, { sourceType: c.sourceType, sourceId: c.sourceId, requiredQty: Number(c.requiredQty) });
  }

  // 切配行 + 调整涉及的净料档案（净料与小料同表），一次查询
  const adjustmentIds = adjustments.map((a) => a.sourceId);
  const allNetIds = [...new Set([...cuttingOrders.map((c) => c.sourceId), ...adjustmentIds])];
  const nets = await prisma.netIngredient.findMany({
    where: { id: { in: allNetIds } },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      packageSpec: true,
      l2Code: true,
      sourceIngredientId: true,
      yieldRate: true,
    },
  });
  const netMap = new Map(nets.map((n) => [n.id, n]));

  // ---- 应用行级调整：覆盖排程行份数 / 追加手工行，并把 delta 折算进采购毛需求 ----
  const overlay = new Map<string, AdjustmentOverlay>();
  for (const adj of adjustments) {
    const net = netMap.get(adj.sourceId);
    if (!net) {
      throw new ProductionPlanAssignmentError(
        `调整的净料（ID ${adj.sourceId}）不存在或已删除`
      );
    }
    const pkg = net.packageSpec != null ? Number(net.packageSpec) : 0;
    if (!(pkg > 0)) {
      throw new ProductionPlanAssignmentError(
        `「${net.name}」缺少封装规格，无法纳入生产计划`
      );
    }
    // 2026-11-28 起新行 sourceType 恒为 net（小料并入净料）；历史快照中的 minor 行经 base 匹配沿用
    const sourceType = "net";
    // 基线行按 sourceId 匹配（sourceType 是 sourceId 的派生属性，防止分类变动产生重复行）
    const base = [...cAgg.values()].find((c) => c.sourceId === adj.sourceId) ?? null;
    const key = (base ? base.sourceType : sourceType) + "-" + adj.sourceId;
    const baseQty = base ? base.requiredQty : 0;
    const basePortions = base ? round2(baseQty / pkg) : null;
    const finalPortions = round2(adj.portions);
    const finalQty = round2(finalPortions * pkg);

    if (base) {
      base.requiredQty = finalQty;
      overlay.set(key, { portions: finalPortions, originalPortions: basePortions, origin: "schedule" });
    } else {
      cAgg.set(key, { sourceType, sourceId: adj.sourceId, requiredQty: finalQty });
      overlay.set(key, { portions: finalPortions, originalPortions: null, origin: "manual" });
    }

    // 行级 delta 折算原料毛需求（与历史内部生产单同口径），无来源原料则只影响切配
    if (net.sourceIngredientId != null) {
      const deltaQty = finalQty - baseQty;
      if (deltaQty !== 0) {
        const grossNeed = calcGrossNeedGrams(
          deltaQty,
          net.yieldRate != null ? Number(net.yieldRate) : 0
        );
        const pKey = "ingredient-" + net.sourceIngredientId;
        const cur = pAgg.get(pKey);
        if (cur) cur.grossNeed += grossNeed;
        else
          pAgg.set(pKey, {
            sourceType: "ingredient",
            sourceId: net.sourceIngredientId,
            grossNeed,
          });
      }
    }
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
    // 行级下调可能把毛需求减到 ≤ 0：按 0 计（行保留，suggestedPurchase 输出 0）
    const grossNeed = Math.max(0, p.grossNeed);
    const grossJin = grossNeed / gramsPerJin; // 毛料用量（斤），不做库存抵扣
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
      grossNeed: round2(grossNeed),
      suggestedPurchase: suggested,
      unit,
      purchaseSpec,
      priceUnit: unit,
      supplierId: row?.defaultSupplierId ?? null,
      supplierName: row?.defaultSupplier?.name ?? null,
      estimatedAmount,
    };
  });

  const cL2Codes = nets.map((n) => n.l2Code).filter((x): x is string => !!x);
  const cL2Cats = await prisma.ingredientCategoryL2.findMany({ where: { code: { in: cL2Codes } }, select: { code: true, name: true, parentCode: true } });
  const cL1Codes = [...new Set(cL2Cats.map((c) => c.parentCode).filter((c): c is string => !!c))];
  const cL1Cats = await prisma.ingredientCategoryL1.findMany({ where: { code: { in: cL1Codes } }, select: { code: true, name: true } });

  const cutting: AggregatedCutting[] = [...cAgg.values()].map((c) => {
    const net = netMap.get(c.sourceId);
    const l2Cat = net ? cL2Cats.find((x) => x.code === net.l2Code) : null;
    const l1Cat = l2Cat ? cL1Cats.find((x) => x.code === l2Cat.parentCode) : null;
    const pkg = net?.packageSpec != null ? Number(net.packageSpec) : null;
    const ov = overlay.get(c.sourceType + "-" + c.sourceId);
    const requiredQty = round2(c.requiredQty);
    const portions = ov ? ov.portions : pkg && pkg > 0 ? round2(requiredQty / pkg) : null;
    const srcId = net?.sourceIngredientId ?? null;
    const grossNeedJin = srcId != null ? grossJinByKey.get("ingredient-" + srcId) ?? null : null;
    return {
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceCode: net?.code ?? "",
      itemName: net?.name ?? "",
      l1Name: l1Cat?.name || "其他",
      l2Name: l2Cat?.name || (net?.l2Code ?? "未分类"),
      packageSpec: pkg,
      requiredQty,
      unit: net?.unit ?? "g",
      portions,
      portionsText: pkg && pkg > 0 ? formatPortions(requiredQty, pkg) : null,
      grossNeedJin: grossNeedJin != null ? round2(grossNeedJin) : null,
      ...(ov ? { origin: ov.origin, originalPortions: ov.originalPortions } : {}),
    };
  });

  cutting.sort((a, b) => a.l1Name.localeCompare(b.l1Name, "zh") || a.l2Name.localeCompare(b.l2Name, "zh") || a.itemName.localeCompare(b.itemName, "zh"));
  purchase.sort((a, b) => a.l1Name.localeCompare(b.l1Name, "zh") || a.l2Name.localeCompare(b.l2Name, "zh") || a.itemName.localeCompare(b.itemName, "zh"));

  return {
    cutting,
    purchase,
    sourceSnapshot: buildProductionPlanSourceSnapshot(sourceSchedules, []),
  };
}
