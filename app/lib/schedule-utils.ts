import { Prisma, PrismaClient } from "@prisma/client";

/** 克 → 斤/g 展示：≥500g 显示斤，<500g 显示 g */
export function formatWeight(g: number): string {
  if (g >= 500) {
    return `${(g / 500).toFixed(2)}斤`;
  }
  return `${Math.round(g)}g`;
}

/** 纯数值：≥500g 返回斤数，否则返回克数 */
export function toWeightValue(g: number): { value: number; unit: string } {
  if (g >= 500) {
    return { value: Number((g / 500).toFixed(2)), unit: "斤" };
  }
  return { value: Math.round(g), unit: "g" };
}

interface ScheduleItemInput {
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
  const seasoningDetails = await prisma.dishSeasoningDetail.findMany({
    where: { dishId: { in: dishIds }, type: "minor" },
  });
  const minorIds = seasoningDetails.map((d) => d.sourceId);
  const minors = await prisma.minorIngredient.findMany({
    where: { id: { in: minorIds } },
    select: { id: true, code: true, name: true, unit: true },
  });

  // 3. 获取分类名称
  const allL2Codes = [
    ...new Set(netDetails.map((d) => d.netIngredient.l2Code).filter(Boolean)),
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

  for (const detail of seasoningDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const minor = minors.find((m) => m.id === detail.sourceId);
    if (!minor) continue;
    const qty = Number(detail.amountG) * item.quantity;

    const existing = minorMap.get(minor.id);
    if (existing) {
      existing.requiredQty += qty;
    } else {
      minorMap.set(minor.id, {
        sourceType: "minor",
        sourceId: minor.id,
        itemName: minor.name,
        l1Code: null,
        l2Code: null,
        l1Name: "其他",
        l2Name: "小料",
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
  items: ScheduleItemInput[]
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
              unit: true,
              priceUnit: true,
              purchaseSpec: true,
              l2Code: true,
            },
          },
        },
      },
    },
  });

  // 2. 获取小料 BOM
  const minorDetails = await prisma.dishSeasoningDetail.findMany({
    where: { dishId: { in: dishIds }, type: "minor" },
  });
  const minorIds = minorDetails.map((d) => d.sourceId);
  const minors = await prisma.minorIngredient.findMany({
    where: { id: { in: minorIds } },
    select: { id: true, code: true, name: true, unit: true, unitPrice: true },
  });

  // 3. 获取调料 BOM
  const seasoningDetails = await prisma.dishSeasoningDetail.findMany({
    where: { dishId: { in: dishIds }, type: "seasoning" },
  });
  const seasoningIds = seasoningDetails.map((d) => d.sourceId);
  const seasonings = await prisma.seasoningIngredient.findMany({
    where: { id: { in: seasoningIds } },
    select: { id: true, code: true, name: true, purchaseUnit: true, purchasePrice: true, productSpec: true },
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

  // 5. 查询当前库存（原料）
  const sourceIngIds = [
    ...new Set(netDetails.map((d) => d.netIngredient.sourceIngredientId).filter(Boolean)),
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

  for (const detail of netDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const src = detail.netIngredient.sourceIngredient;
    if (!src) continue;

    const netNeed = Number(detail.amountG) * item.quantity; // 净料总需求(g)
    const yieldRate = Number(detail.netIngredient.yieldRate);
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
        unit: src.unit,
        purchaseSpec: src.purchaseSpec,
        priceUnit: src.priceUnit,
      });
    }
  }

  // 7. 汇总小料
  const minorMap = new Map<
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

  for (const detail of minorDetails) {
    const item = items.find((i) => i.dishId === detail.dishId);
    if (!item) continue;
    const minor = minors.find((m) => m.id === detail.sourceId);
    if (!minor) continue;
    const need = Number(detail.amountG) * item.quantity;

    const existing = minorMap.get(minor.id);
    if (existing) {
      existing.grossNeed += need;
    } else {
      minorMap.set(minor.id, {
        sourceType: "minor",
        sourceId: minor.id,
        itemName: minor.name,
        l2Code: null,
        grossNeed: need,
        unit: minor.unit,
        purchaseSpec: null,
        priceUnit: minor.unit,
      });
    }
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
        l2Code: null,
        grossNeed: need,
        unit: seasoning.purchaseUnit,
        purchaseSpec: seasoning.productSpec,
        priceUnit: seasoning.purchaseUnit,
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
    ...minorMap.values(),
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
