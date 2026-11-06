import { calcJinPerPurchaseUnit } from "@/lib/shared/spec-parser";
import { getJinFactors, getGramsPerJin, getWeightUnitNames } from "@/lib/server/unit-factors";
import type { Prisma, PrismaClient } from "@prisma/client";

// 注意：本文件仅使用 Prisma 作为「类型标注」，未实例化 PrismaClient。
// 服务端业务算法，仅可被服务端 API 路由 import（不可进客户端 bundle）。
// 共享纯展示函数 formatWeight/toWeightValue 见 @/lib/shared/weight-format。

export interface ScheduleItemInput {
  dishId: number;
  quantity: number;
}

/** 根据菜品清单构建切配工单数据 */
export async function buildCuttingOrders(
  prisma: PrismaClient | Prisma.TransactionClient,
  scheduleId: number,
  items: ScheduleItemInput[]
) {
  const dishIds = items.map((i) => i.dishId);

  // 1. 获取所有菜品的主料/辅料 BOM
  const netDetails = await prisma.dishNetDetail.findMany({
    where: { dishId: { in: dishIds } },
    include: {
      netIngredient: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          l2Code: true,
          packageSpec: true,
          sourceIngredient: { select: { l2Code: true } },
        },
      },
    },
  });

  // 2. 获取所有菜品的小料 BOM
  const minorDetails = await prisma.dishMinorDetail.findMany({
    where: { dishId: { in: dishIds } },
    include: {
      netIngredient: {
        select: { id: true, code: true, name: true, unit: true, l2Code: true, spec: true, packageSpec: true },
      },
    },
  });

  // 3. 获取分类名称（包含小料）
  const allL2Codes = [
    ...new Set([
      ...netDetails.map((d) => d.netIngredient.l2Code).filter(Boolean),
      ...minorDetails.map((d) => d.netIngredient.l2Code).filter(Boolean),
    ]),
  ];
  const l2Cats = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: allL2Codes } },
    select: { code: true, name: true, parentCode: true },
  });
  const l1Codes = [...new Set(l2Cats.map((c) => c.parentCode).filter(Boolean))];
  const l1Cats = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: l1Codes } },
    select: { code: true, name: true },
  });

  // 4. 汇总净料（主料/辅料）
  const netMap = new Map<
    number,
    {
      sourceType: string;
      sourceId: number;
      itemName: string;
      l1Code: string | null;
      l2Code: string | null;
      l1Name: string | null;
      l2Name: string | null;
      requiredQty: number;
      unit: string;
      spec: string;
      sourceCode: string;
      packageSpec: number | null;
    }
  >();

  for (const detail of netDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const net = detail.netIngredient;
    const qty = Number(detail.amountG) * item.quantity;

    const existing = netMap.get(net.id);
    if (existing) {
      existing.requiredQty += qty;
    } else {
      const l2 = l2Cats.find((c) => c.code === net.l2Code);
      const l1 = l2 ? l1Cats.find((c) => c.code === l2.parentCode) : null;
      netMap.set(net.id, {
        sourceType: "net",
        sourceId: net.id,
        itemName: net.name,
        l1Code: l1?.code || null,
        l2Code: l2?.code || null,
        l1Name: l1?.name || null,
        l2Name: l2?.name || null,
        requiredQty: qty,
        unit: net.unit,
        spec: "",
        sourceCode: net.code,
        packageSpec: net.packageSpec != null ? Number(net.packageSpec) : null,
      });
    }
  }

  // 5. 汇总小料
  const minorMap = new Map<
    number,
    {
      sourceType: string;
      sourceId: number;
      itemName: string;
      l1Code: string | null;
      l2Code: string | null;
      l1Name: string | null;
      l2Name: string | null;
      requiredQty: number;
      unit: string;
      spec: string;
      sourceCode: string;
      packageSpec: number | null;
    }
  >();

  for (const detail of minorDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const minor = detail.netIngredient;
    if (!minor) continue;
    const qty = Number(detail.amountG) * item.quantity;

    const existing = minorMap.get(minor.id);
    if (existing) {
      existing.requiredQty += qty;
    } else {
      const l2 = l2Cats.find((c) => c.code === minor.l2Code);
      const l1 = l2 ? l1Cats.find((c) => c.code === l2.parentCode) : null;
      minorMap.set(minor.id, {
        sourceType: "minor",
        sourceId: minor.id,
        itemName: minor.name,
        l1Code: l1?.code || null,
        l2Code: l2?.code || null,
        l1Name: l1?.name || "其他",
        l2Name: l2?.name || "小料",
        requiredQty: qty,
        unit: minor.unit,
        spec: "",
        sourceCode: minor.code,
        packageSpec: minor.packageSpec != null ? Number(minor.packageSpec) : null,
      });
    }
  }

  // 6. 合并为 CuttingOrder 创建数据
  const cuttingOrders = [...netMap.values(), ...minorMap.values()].map((d) => ({
    scheduleId,
    sourceType: d.sourceType,
    sourceId: d.sourceId,
    itemName: d.itemName,
    l1Code: d.l1Code,
    l2Code: d.l2Code,
    spec: d.spec,
    sourceCode: d.sourceCode,
    packageSpec: d.packageSpec,
    requiredQty: d.requiredQty,
    unit: d.unit,
    actualQty: null as number | null,
  }));

  return cuttingOrders;
}

/**
 * 根据菜品清单构建采购计划数据。
 *
 * 量纲链（统一口径）：
 *   净料需求(g) × 100 ÷ 出成率(%) = 毛料需求(g)
 *   毛料需求(斤) = 毛料需求(g) ÷ 每斤克数（单位字典）
 *   库存抵扣(斤) = 库存(入库单位) × 每入库单位斤数，封顶毛料需求斤数
 *   建议采购量 = 需采购斤数 ÷ 每采购单位斤数（向上取整）；无法换算时按斤建议（2 位小数）
 *   预估金额 = 需采购斤数 × 每斤单价（元/斤）
 *
 * 每采购单位斤数与食材档案「每斤单价」换算共用 lib/shared/spec-parser 同一套解析，保证口径一致。
 */
export async function buildPurchasePlans(
  prisma: PrismaClient | Prisma.TransactionClient,
  scheduleId: number,
  items: ScheduleItemInput[],
  seasoningL2Codes: string[]
) {
  const dishIds = items.map((i) => i.dishId);
  const [jinFactors, gramsPerJin, weightUnitNames] = await Promise.all([
    getJinFactors(prisma),
    getGramsPerJin(prisma),
    getWeightUnitNames(prisma),
  ]);

  // 1. 获取主料/辅料 BOM → 原料
  const netDetails = await prisma.dishNetDetail.findMany({
    where: { dishId: { in: dishIds } },
    include: {
      netIngredient: {
        select: {
          id: true,
          yieldRate: true,
          sourceIngredientId: true,
          sourceIngredient: {
            select: {
              id: true,
              code: true,
              name: true,
              stockUnit: true,
              purchaseUnit: true,
              purchaseSpec: true,
              l2Code: true,
              unitsPerPurchase: true,
              latestRefPrice: true,
              pricePerJin: true,
              defaultSupplierId: true,
              defaultSupplier: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // 2. 获取小料 BOM（小料与净料同口径：由原料转化，采购时按出成率折算进原料毛需求）
  const minorDetails = await prisma.dishMinorDetail.findMany({
    where: { dishId: { in: dishIds } },
    include: {
      netIngredient: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          unitPrice: true,
          l2Code: true,
          spec: true,
          packageSpec: true,
          yieldRate: true,
          sourceIngredientId: true,
          sourceIngredient: {
            select: {
              id: true,
              code: true,
              name: true,
              stockUnit: true,
              purchaseUnit: true,
              purchaseSpec: true,
              l2Code: true,
              unitsPerPurchase: true,
              latestRefPrice: true,
              pricePerJin: true,
              defaultSupplierId: true,
              defaultSupplier: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // 3. 获取调料 BOM
  const seasoningDetails = await prisma.dishSeasoningDetail.findMany({
    where: { dishId: { in: dishIds } },
  });
  const seasoningIds = seasoningDetails.map((d) => d.sourceId);
  const seasonings = await prisma.ingredient.findMany({
    where: { id: { in: seasoningIds }, l2Code: { in: seasoningL2Codes } },
    select: {
      id: true,
      code: true,
      name: true,
      l2Code: true,
      purchaseUnit: true,
      stockUnit: true,
      purchaseSpec: true,
      latestRefPrice: true,
      pricePerJin: true,
      unitsPerPurchase: true,
      defaultSupplierId: true,
      defaultSupplier: { select: { name: true } },
    },
  });

  // 4. 获取酱料 BOM
  const sauceDetails = await prisma.dishSauceDetail.findMany({
    where: { dishId: { in: dishIds } },
  });
  const sauceIds = sauceDetails.map((d) => d.sauceId);
  const sauces = await prisma.sauceIngredient.findMany({
    where: { id: { in: sauceIds } },
    select: {
      id: true,
      code: true,
      name: true,
      purchaseSpec: true,
      purchaseUnit: true,
      pricePerJin: true,
      defaultSupplierId: true,
      defaultSupplier: { select: { name: true } },
    },
  });

  // 5. 查询当前库存（原料 + 调料，ingredientId 同表）
  const stockIngIds = [
    ...new Set([
      ...netDetails.map((d) => d.netIngredient.sourceIngredientId),
      ...minorDetails.map((d) => d.netIngredient.sourceIngredientId),
      ...seasoningIds,
    ].filter((id): id is number => id != null)),
  ];
  const inventories = await prisma.inventory.findMany({
    where: { ingredientId: { in: stockIngIds } },
    select: { ingredientId: true, currentQty: true },
  });
  const invMap = new Map(inventories.map((i) => [i.ingredientId, Number(i.currentQty)]));

  interface PlanAgg {
    sourceType: string;
    sourceId: number;
    sourceCode: string;
    itemName: string;
    l2Code: string | null;
    grossNeed: number; // 克
    purchaseUnit: string | null;
    purchaseSpec: string | null;
    stockUnit: string | null;
    unitsPerPurchase: number;
    pricePerJin: number | null;
    latestRefPrice: number | null;
    supplierId: number | null;
    supplierName: string | null;
  }

  // 6. 汇总原料（净料/小料按出成率折算毛需求，百分数口径：毛料 = 净需求 × 100 ÷ 出成率）
  const ingredientMap = new Map<number, PlanAgg>();

  const addSourceGrossNeed = (
    src: {
      id: number;
      code: string;
      name: string;
      l2Code: string;
      purchaseUnit: string | null;
      stockUnit: string | null;
      purchaseSpec: string | null;
      unitsPerPurchase: number;
      latestRefPrice?: unknown;
      pricePerJin: unknown;
      defaultSupplierId: number | null;
      defaultSupplier: { name: string } | null;
    },
    netNeed: number,
    yieldRate: number
  ) => {
    const grossNeed = yieldRate > 0 ? (netNeed * 100) / yieldRate : netNeed; // 原料毛需求(g)

    const existing = ingredientMap.get(src.id);
    if (existing) {
      existing.grossNeed += grossNeed;
    } else {
      ingredientMap.set(src.id, {
        sourceType: "ingredient",
        sourceId: src.id,
        sourceCode: src.code,
        itemName: src.name,
        l2Code: src.l2Code,
        grossNeed,
        purchaseUnit: src.purchaseUnit,
        purchaseSpec: src.purchaseSpec,
        stockUnit: src.stockUnit,
        unitsPerPurchase: src.unitsPerPurchase || 1,
        latestRefPrice: src.latestRefPrice != null ? Number(src.latestRefPrice) : null,
        pricePerJin: src.pricePerJin != null ? Number(src.pricePerJin) : null,
        supplierId: src.defaultSupplierId ?? null,
        supplierName: src.defaultSupplier?.name ?? null,
      });
    }
  };

  for (const detail of netDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const src = detail.netIngredient.sourceIngredient;
    if (!src) continue;

    const netNeed = Number(detail.amountG) * item.quantity; // 净料总需求(g)
    addSourceGrossNeed(src, netNeed, Number(detail.netIngredient.yieldRate));
  }

  // 7. 小料同口径并入原料毛需求（不再作为独立采购品）
  for (const detail of minorDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const src = detail.netIngredient.sourceIngredient;
    if (!src) continue;

    const minorNeed = Number(detail.amountG) * item.quantity; // 小料总需求(g)
    addSourceGrossNeed(src, minorNeed, Number(detail.netIngredient.yieldRate));
  }

  // 8. 汇总调料（出成率 100：直接用克需求）
  const seasoningMap = new Map<number, PlanAgg>();

  for (const detail of seasoningDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const seasoning = seasonings.find((s) => s.id === detail.sourceId);
    if (!seasoning) continue;
    const need = Number(detail.amountG) * item.quantity;

    const existing = seasoningMap.get(seasoning.id);
    if (existing) {
      existing.grossNeed += need;
    } else {
      seasoningMap.set(seasoning.id, {
        sourceType: "seasoning",
        sourceId: seasoning.id,
        sourceCode: seasoning.code,
        itemName: seasoning.name,
        l2Code: seasoning.l2Code,
        grossNeed: need,
        purchaseUnit: seasoning.purchaseUnit,
        purchaseSpec: seasoning.purchaseSpec,
        stockUnit: seasoning.stockUnit,
        unitsPerPurchase: seasoning.unitsPerPurchase || 1,
        latestRefPrice: seasoning.latestRefPrice != null ? Number(seasoning.latestRefPrice) : null,
        pricePerJin: seasoning.pricePerJin != null ? Number(seasoning.pricePerJin) : null,
        supplierId: seasoning.defaultSupplierId ?? null,
        supplierName: seasoning.defaultSupplier?.name ?? null,
      });
    }
  }

  // 9. 汇总酱料（出成率 100，采购口径按斤）
  const sauceMap = new Map<number, PlanAgg>();

  for (const detail of sauceDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const sauce = sauces.find((s) => s.id === detail.sauceId);
    if (!sauce) continue;
    const need = Number(detail.amountG) * item.quantity;

    const existing = sauceMap.get(sauce.id);
    if (existing) {
      existing.grossNeed += need;
    } else {
      sauceMap.set(sauce.id, {
        sourceType: "sauce",
        sourceId: sauce.id,
        sourceCode: sauce.code,
        itemName: sauce.name,
        l2Code: null,
        grossNeed: need,
        purchaseUnit: sauce.purchaseUnit,
        purchaseSpec: sauce.purchaseSpec,
        stockUnit: "斤",
        unitsPerPurchase: 1,
        latestRefPrice: null,
        pricePerJin: sauce.pricePerJin != null ? Number(sauce.pricePerJin) : null,
        supplierId: sauce.defaultSupplierId ?? null,
        supplierName: sauce.defaultSupplier?.name ?? null,
      });
    }
  }

  // 10. 量纲换算：克 → 斤 → 采购单位，计算库存抵扣 / 建议采购量 / 预估金额
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const allPlans = [
    ...ingredientMap.values(),
    ...seasoningMap.values(),
    ...sauceMap.values(),
  ];

  const purchasePlans = allPlans.map((p) => {
    const grossJin = p.grossNeed / gramsPerJin; // 毛料需求(斤)

    // 每采购单位斤数（与档案每斤单价换算同口径）
    const jinPerPurchase = calcJinPerPurchaseUnit(p.purchaseSpec ?? "", jinFactors);
    // 每入库单位斤数：入库单位本身是斤 = 1；否则 每采购单位斤数 ÷ 每采购单位入库数
    let jinPerStock: number | null = null;
    if (p.stockUnit === "斤") {
      jinPerStock = 1;
    } else if (jinPerPurchase != null && p.unitsPerPurchase > 0) {
      jinPerStock = jinPerPurchase / p.unitsPerPurchase;
    }

    // 库存抵扣（斤），无换算口径时保守不抵扣
    const stockQty = invMap.get(p.sourceId) || 0;
    const stockJin = jinPerStock != null ? stockQty * jinPerStock : 0;
    const deductJin = Math.min(stockJin, grossJin);
    const needJin = Math.max(0, grossJin - deductJin);

    // 采购单位是否重量单位（散称/按重直采）：空采购单位视为散称按斤
    const isWeightPurchase = !p.purchaseUnit || weightUnitNames.has(p.purchaseUnit);

    // 建议采购量口径：
    //   散称/按重直采 → 按实际斤数（2 位小数）
    //   计件标品（规格可换算）→ 向上取整到整数采购单位
    //   计件标品（规格无法换算，如 1.9升*6瓶）→ 最小采购单位 1 件
    let suggested: number;
    let unit: string;
    if (!isWeightPurchase && p.purchaseUnit) {
      if (jinPerPurchase != null) {
        suggested = needJin > 0 ? Math.ceil(needJin / jinPerPurchase - 1e-9) : 0;
      } else {
        suggested = needJin > 0 ? 1 : 0;
      }
      unit = p.purchaseUnit;
    } else {
      suggested = round2(needJin);
      unit = "斤";
    }

    // 预估金额 = 实际采购口径的金额：
    //   计件 → 采购单位数 × 每采购单位成本价（参考单价优先，其次 每单位斤数 × 每斤单价）
    //   散称按斤 → 需采购斤数 × 每斤单价
    let estimatedAmount: number | null;
    if (!isWeightPurchase && p.purchaseUnit) {
      const costPerPurchase =
        p.latestRefPrice ??
        (jinPerPurchase != null && p.pricePerJin != null ? round2(jinPerPurchase * p.pricePerJin) : null);
      estimatedAmount = costPerPurchase != null && suggested > 0 ? round2(suggested * costPerPurchase) : null;
    } else {
      estimatedAmount = p.pricePerJin != null && needJin > 0 ? round2(needJin * p.pricePerJin) : null;
    }

    return {
      scheduleId,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      sourceCode: p.sourceCode,
      itemName: p.itemName,
      l2Code: p.l2Code,
      grossNeed: round2(p.grossNeed), // 克
      stockDeducted: round2(deductJin), // 斤（实际抵扣库存）
      suggestedPurchase: suggested, // 采购单位数量；无法换算时为斤
      unit,
      purchaseSpec: p.purchaseSpec,
      priceUnit: unit,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      estimatedAmount,
      actualPurchase: null as number | null,
      actualAmount: null as number | null,
    };
  });

  return purchasePlans;
}

