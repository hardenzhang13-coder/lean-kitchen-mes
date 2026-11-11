import { formatPortions } from "@/lib/shared/weight-format";
import { prisma } from "@/lib/server/prisma";
import { resolveUsernameToName } from "@/lib/server/user-resolve";

/**
 * 排程详情数据组装（API 与打印页共用）。
 * 输出为纯 JSON 可序列化对象（Decimal/Date 均转为基础类型）。
 */
export async function getScheduleDetail(scheduleId: number) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      store: { select: { id: true, name: true } },
      items: {
        include: {
          dish: {
            select: {
              id: true,
              code: true,
              name: true,
              portion: true,
              meatType: true,
              cost: true,
              price: true,
              category: { select: { name: true } },
            },
          },
        },
      },
      cuttingOrders: { orderBy: [{ l1Code: "asc" }, { l2Code: "asc" }, { itemName: "asc" }] },
      purchasePlans: { orderBy: [{ l2Code: "asc" }, { itemName: "asc" }] },
      productionPlanRefs: {
        where: { plan: { deletedAt: null } },
        orderBy: { id: "desc" },
        take: 1,
        select: {
          plan: {
            select: {
              id: true,
              code: true,
              title: true,
              planDate: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!schedule) return null;

  const operatorName = await resolveUsernameToName(schedule.operator);

  // 切配工单的分类名称
  const l1Codes = [...new Set(schedule.cuttingOrders.map((c) => c.l1Code).filter((c): c is string => !!c))];
  const l2Codes = [...new Set(schedule.cuttingOrders.map((c) => c.l2Code).filter((c): c is string => !!c))];
  const [l1Cats, l2Cats] = await Promise.all([
    prisma.ingredientCategoryL1.findMany({ where: { code: { in: l1Codes } }, select: { code: true, name: true } }),
    prisma.ingredientCategoryL2.findMany({ where: { code: { in: l2Codes } }, select: { code: true, name: true } }),
  ]);

  // 采购计划的分类名称（二级 → 一级）
  const pL2Codes = [...new Set(schedule.purchasePlans.map((p) => p.l2Code).filter((c): c is string => !!c))];
  const pL2Cats = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: pL2Codes } },
    select: { code: true, name: true, parentCode: true },
  });
  const pL1Codes = [...new Set(pL2Cats.map((c) => c.parentCode).filter((c): c is string => !!c))];
  const pL1Cats = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: pL1Codes } },
    select: { code: true, name: true },
  });

  // 切配工单的毛料用量（斤）：净料/小料经来源原料关联到采购计划的毛需求
  const netIds = schedule.cuttingOrders.filter((c) => c.sourceType === "net").map((c) => c.sourceId);
  const minorIds = schedule.cuttingOrders.filter((c) => c.sourceType === "minor").map((c) => c.sourceId);
  const cuttingSources = await prisma.netIngredient.findMany({
    where: { id: { in: [...netIds, ...minorIds] } },
    select: { id: true, sourceIngredientId: true },
  });
  const sourceIdByNetId = new Map<number, number | null>();
  cuttingSources.forEach((n) => sourceIdByNetId.set(n.id, n.sourceIngredientId));
  // 原料毛需求（斤）：采购计划中 sourceType = ingredient 的行
  const grossJinByIngredientId = new Map<number, number>();
  schedule.purchasePlans
    .filter((p) => p.sourceType === "ingredient")
    .forEach((p) => grossJinByIngredientId.set(p.sourceId, Number(p.grossNeed) / 500));

  return {
    id: schedule.id,
    code: schedule.code,
    title: schedule.title,
    scheduleDate: schedule.scheduleDate.toISOString(),
    status: schedule.status,
    operator: schedule.operator,
    operatorName,
    createdAt: schedule.createdAt.toISOString(),
    store: schedule.store,
    productionPlan: schedule.productionPlanRefs[0]?.plan ?? null,
    items: schedule.items.map((it) => ({
      id: it.id,
      dishId: it.dishId,
      quantity: it.quantity,
      // 销售回录：空 = 未回录
      soldQty: it.actualSoldQty != null ? Number(it.actualSoldQty) : null,
      soldRecordedAt: it.soldRecordedAt ? it.soldRecordedAt.toISOString() : null,
      soldRecordedBy: it.soldRecordedBy,
      dish: it.dish,
    })),
    cuttingOrders: schedule.cuttingOrders.map((c) => ({
      id: c.id,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      sourceCode: c.sourceCode,
      packageSpec: c.packageSpec != null ? Number(c.packageSpec) : null,
      itemName: c.itemName,
      l1Code: c.l1Code,
      l2Code: c.l2Code,
      l1Name: l1Cats.find((cat) => cat.code === c.l1Code)?.name || c.l1Code || "其他",
      l2Name: l2Cats.find((cat) => cat.code === c.l2Code)?.name || c.l2Code || "小料",
      spec: c.spec,
      requiredQty: Number(c.requiredQty),
      unit: c.unit,
      // 切配份数 = 切配量 ÷ 封装规格（净料档案 packageSpec 字段）
      portions:
        c.packageSpec != null && Number(c.packageSpec) > 0
          ? Math.round((Number(c.requiredQty) / Number(c.packageSpec)) * 100) / 100
          : null,
      portionsText:
        c.packageSpec != null && Number(c.packageSpec) > 0
          ? formatPortions(Number(c.requiredQty), Number(c.packageSpec))
          : null,
      grossNeedJin: (() => {
        const srcId = sourceIdByNetId.get(c.sourceId);
        return srcId != null ? grossJinByIngredientId.get(srcId) ?? null : null;
      })(),
    })),
    purchasePlans: schedule.purchasePlans.map((p) => {
      const l2Cat = pL2Cats.find((cat) => cat.code === p.l2Code);
      const l1Cat = l2Cat ? pL1Cats.find((cat) => cat.code === l2Cat.parentCode) : null;
      const suggested = Number(p.suggestedPurchase);
      const estimatedAmount = p.estimatedAmount != null ? Number(p.estimatedAmount) : null;
      return {
        id: p.id,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        sourceCode: p.sourceCode,
        itemName: p.itemName,
        l1Code: l1Cat?.code ?? null,
        l2Code: p.l2Code,
        l1Name: l1Cat?.name || "其他",
        l2Name: l2Cat?.name || p.l2Code || "—",
        grossNeed: Number(p.grossNeed),
        stockDeducted: Number(p.stockDeducted),
        suggestedPurchase: suggested,
        unit: p.unit,
        purchaseSpec: p.purchaseSpec,
        priceUnit: p.priceUnit,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        estimatedAmount,
      };
    }),
    totalQuantity: schedule.items.reduce((s, it) => s + it.quantity, 0),
    dishCount: schedule.items.length,
  };
}

/** 克 → 斤（1斤 = 500g），保留 2 位小数 */
export function gramsToJin(grams: number): string {
  return (grams / 500).toFixed(2);
}
