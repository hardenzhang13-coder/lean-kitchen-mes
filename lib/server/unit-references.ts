import { prisma } from "@/lib/server/prisma";

// 单位引用检查（服务端）。
// 业务表中的单位是自由文本（非外键），删除/改名单位前必须确认无引用，
// 否则会产生悬空数据或使存量数据语义漂移。

/** 引用单位名称的业务表及字段清单（值为中文实体名，用于提示） */
const UNIT_REFERENCE_TARGETS: Array<{
  entity: string;
  fields: string[];
  count: (name: string) => Promise<number>;
}> = [
  {
    entity: "原料",
    fields: ["purchaseUnit", "stockUnit"],
    count: (name) =>
      prisma.ingredient.count({
        where: {
          OR: [{ purchaseUnit: name }, { stockUnit: name }],
        },
      }),
  },
  {
    entity: "净料",
    fields: ["unit"],
    count: (name) => prisma.netIngredient.count({ where: { unit: name } }),
  },
  {
    entity: "酱料",
    fields: ["unit"],
    count: (name) => prisma.sauceIngredient.count({ where: { unit: name } }),
  },
  {
    entity: "采购计划",
    fields: ["unit", "priceUnit"],
    count: (name) =>
      prisma.purchasePlan.count({
        where: { OR: [{ unit: name }, { priceUnit: name }] },
      }),
  },
  {
    entity: "切配工单",
    fields: ["unit"],
    count: (name) => prisma.cuttingOrder.count({ where: { unit: name } }),
  },
  {
    entity: "采购单明细",
    fields: ["priceUnit", "purchaseUnit", "stockUnit"],
    count: (name) =>
      prisma.purchaseReceiptItem.count({
        where: {
          OR: [{ priceUnit: name }, { purchaseUnit: name }, { stockUnit: name }],
        },
      }),
  },
  {
    entity: "库存",
    fields: ["unit"],
    count: (name) => prisma.inventory.count({ where: { unit: name } }),
  },
  {
    entity: "库存流水",
    fields: ["unit"],
    count: (name) => prisma.inventoryLedger.count({ where: { unit: name } }),
  },
];

export interface UnitReferenceResult {
  total: number;
  byEntity: Record<string, number>;
}

/** 统计某单位名称被多少条业务数据引用 */
export async function countUnitReferences(name: string): Promise<UnitReferenceResult> {
  const results = await Promise.all(
    UNIT_REFERENCE_TARGETS.map(async (t) => ({
      entity: t.entity,
      count: await t.count(name),
    }))
  );
  const byEntity: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    if (r.count > 0) byEntity[r.entity] = r.count;
    total += r.count;
  }
  return { total, byEntity };
}
