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
        select: { id: true, code: true, name: true, unit: true, l2Code: true },
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
    spec: "",
    requiredQty: d.requiredQty,
    unit: d.unit,
    actualQty: null as number | null,
  }));

  return cuttingOrders;
}

/** 根据菜品清单构建采购计划数据 */
export async function buildPurchasePlans(
  prisma: PrismaClient | Prisma.TransactionClient,
  scheduleId: number,
  items: ScheduleItemInput[],
  seasoningL2Codes: string[]
) {
  const dishIds = items.map((i) => i.dishId);

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
    select: { id: true, code: true, name: true, l2Code: true, purchaseUnit: true, stockUnit: true, latestRefPrice: true, purchaseSpec: true },
  });

  // 4. 获取酱料 BOM
  const sauceDetails = await prisma.dishSauceDetail.findMany({
    where: { dishId: { in: dishIds } },
  });
  const sauceIds = sauceDetails.map((d) => d.sauceId);
  const sauces = await prisma.sauceIngredient.findMany({
    where: { id: { in: sauceIds } },
    select: { id: true, code: true, name: true, unit: true, unitPrice: true },
  });

  // 5. 查询当前库存（原料）：净料与小料的来源原料并集
  const sourceIngIds = [
    ...new Set([
      ...netDetails.map((d) => d.netIngredient.sourceIngredientId),
      ...minorDetails.map((d) => d.netIngredient.sourceIngredientId),
    ].filter((id): id is number => id != null)),
  ];
  const inventories = await prisma.inventory.findMany({
    where: { ingredientId: { in: sourceIngIds } },
    select: { ingredientId: true, currentQty: true },
  });
  const invMap = new Map(inventories.map((i) => [i.ingredientId, Number(i.currentQty)]));

  // 6. 汇总原料
  const ingredientMap = new Map<
    number,
    {
      sourceType: string;
      sourceId: number;
      itemName: string;
      l2Code: string | null;
      grossNeed: number;
      unit: string;
      purchaseSpec: string | null;
      priceUnit: string | null;
    }
  >();

  // 净料/小料净需求(g) 按出成率折算为原料毛需求(g)，按来源原料聚合
  const addSourceGrossNeed = (
    src: { id: number; name: string; l2Code: string; purchaseUnit: string | null; stockUnit: string | null; purchaseSpec: string | null },
    netNeed: number,
    yieldRate: number
  ) => {
    const grossNeed = yieldRate > 0 ? netNeed / yieldRate : netNeed; // 原料需求(g)

    const existing = ingredientMap.get(src.id);
    if (existing) {
      existing.grossNeed += grossNeed;
    } else {
      ingredientMap.set(src.id, {
        sourceType: "ingredient",
        sourceId: src.id,
        itemName: src.name,
        l2Code: src.l2Code,
        grossNeed,
        unit: src.purchaseUnit || src.stockUnit || "斤",
        purchaseSpec: src.purchaseSpec,
        priceUnit: src.purchaseUnit || src.stockUnit || "斤",
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

  // 8. 汇总调料
  const seasoningMap = new Map<
    number,
    {
      sourceType: string;
      sourceId: number;
      itemName: string;
      l2Code: string | null;
      grossNeed: number;
      unit: string;
      purchaseSpec: string | null;
      priceUnit: string | null;
    }
  >();

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
        itemName: seasoning.name,
        l2Code: seasoning.l2Code,
        grossNeed: need,
        unit: seasoning.purchaseUnit || seasoning.stockUnit || "件",
        purchaseSpec: seasoning.purchaseSpec,
        priceUnit: seasoning.purchaseUnit || seasoning.stockUnit || "件",
      });
    }
  }

  // 9. 汇总酱料
  const sauceMap = new Map<
    number,
    {
      sourceType: string;
      sourceId: number;
      itemName: string;
      l2Code: string | null;
      grossNeed: number;
      unit: string;
      purchaseSpec: string | null;
      priceUnit: string | null;
    }
  >();

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
        itemName: sauce.name,
        l2Code: null,
        grossNeed: need,
        unit: sauce.unit,
        purchaseSpec: null,
        priceUnit: sauce.unit,
      });
    }
  }

  // 10. 合并并计算库存扣除
  const allPlans = [
    ...ingredientMap.values(),
    ...seasoningMap.values(),
    ...sauceMap.values(),
  ];

  const purchasePlans = allPlans.map((p) => {
    const stock = p.sourceType === "ingredient" ? invMap.get(p.sourceId) || 0 : 0;
    const suggested = Math.max(0, p.grossNeed - stock);
    return {
      scheduleId,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      itemName: p.itemName,
      l2Code: p.l2Code,
      grossNeed: p.grossNeed,
      stockDeducted: stock,
      suggestedPurchase: suggested,
      unit: p.unit,
      purchaseSpec: p.purchaseSpec,
      priceUnit: p.priceUnit,
      actualPurchase: null as number | null,
      actualAmount: null as number | null,
    };
  });

  return purchasePlans;
}
