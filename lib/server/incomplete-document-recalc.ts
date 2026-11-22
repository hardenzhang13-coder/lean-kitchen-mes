import type { Prisma } from "@prisma/client";
import { buildCuttingOrders, buildPurchasePlans } from "@/lib/server/schedule-utils";
import {
  buildProductionPlanData,
  planAdjustmentsFromCuttingJson,
} from "@/lib/server/production-plan-utils";

export interface IncompleteRecalcResult {
  scheduleIds: number[];
  planIds: number[];
}

/** 单据已有生产/出库进度时，禁止自动重算，整单事务回滚 */
export class BomSyncConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "BomSyncConflictError";
  }
}

export function hasPlanProgress(cuttingJson: unknown): boolean {
  if (!Array.isArray(cuttingJson)) return false;
  return cuttingJson.some((row) => {
    if (!row || typeof row !== "object") return false;
    const record = row as Record<string, unknown>;
    return record.confirmStatus != null || record.actualPortions != null;
  });
}

export async function assertScheduleHasNoProgress(
  tx: Prisma.TransactionClient,
  scheduleId: number,
  scheduleCode: string | null
): Promise<void> {
  const [cuttingProgress, purchaseProgress, outboundCount, soldCount] = await Promise.all([
    tx.cuttingOrder.count({
      where: {
        scheduleId,
        OR: [{ status: { not: "pending" } }, { actualQty: { not: null } }],
      },
    }),
    tx.purchasePlan.count({
      where: {
        scheduleId,
        OR: [
          { status: { not: "pending" } },
          { actualPurchase: { not: null } },
          { actualAmount: { not: null } },
        ],
      },
    }),
    tx.outboundOrder.count({ where: { scheduleId, status: "confirmed" } }),
    tx.scheduleItem.count({
      where: { scheduleId, actualSoldQty: { not: null } },
    }),
  ]);

  if (cuttingProgress > 0 || purchaseProgress > 0 || outboundCount > 0 || soldCount > 0) {
    throw new BomSyncConflictError(
      `排程 ${scheduleCode ?? scheduleId} 已有生产/出库/销售回录进度，不能自动重算，请先完成或作废相关单据`
    );
  }
}

/**
 * 净料/小料规格变更后，重建引用它的“未完成单据”：
 * - 待生效 / 进行中的排程：切配工单与采购计划；
 * - 引用这些排程、或引用相关内部生产单的待生效 / 进行中生产计划：三份 JSON 快照。
 * 已完成单据、出库单、库存流水一律不动；发现任何执行进度直接抛 409 并回滚。
 */
export async function recalcIncompleteDocumentsForNetIngredient(
  tx: Prisma.TransactionClient,
  netIngredientId: number
): Promise<IncompleteRecalcResult> {
  const [netRows, minorRows] = await Promise.all([
    tx.dishNetDetail.findMany({
      where: { netIngId: netIngredientId },
      select: { dishId: true },
    }),
    tx.dishMinorDetail.findMany({
      where: { netIngId: netIngredientId },
      select: { dishId: true },
    }),
  ]);
  const dishIds = [...new Set([...netRows, ...minorRows].map((row) => row.dishId))];

  const recalculatedSchedules: number[] = [];

  if (dishIds.length > 0) {
    const seasoningL2Codes = (
      await tx.ingredientCategoryL2.findMany({
        where: { parentCode: "SEA" },
        select: { code: true },
      })
    ).map((row) => row.code);

    const schedules = await tx.schedule.findMany({
      where: {
        status: { in: ["待生效", "进行中"] },
        items: { some: { dishId: { in: dishIds } } },
      },
      select: {
        id: true,
        code: true,
        items: { select: { dishId: true, quantity: true } },
      },
    });

    for (const schedule of schedules) {
      await assertScheduleHasNoProgress(tx, schedule.id, schedule.code);

      const items = schedule.items.map((item) => ({
        dishId: item.dishId,
        quantity: item.quantity,
      }));
      const cutting = await buildCuttingOrders(tx, schedule.id, items);
      const purchase = await buildPurchasePlans(tx, schedule.id, items, seasoningL2Codes);

      await tx.cuttingOrder.deleteMany({ where: { scheduleId: schedule.id } });
      await tx.purchasePlan.deleteMany({ where: { scheduleId: schedule.id } });
      if (cutting.length > 0) {
        await tx.cuttingOrder.createMany({ data: cutting });
      }
      if (purchase.length > 0) {
        await tx.purchasePlan.createMany({ data: purchase });
      }
      recalculatedSchedules.push(schedule.id);
    }
  }

  // 引用该净料/小料的内部生产单；其所在未完成计划也要重算份数 × 新规格
  const selfItems = await tx.selfProductionItem.findMany({
    where: { sourceId: netIngredientId },
    select: { orderId: true },
  });
  const selfOrderIds = [...new Set(selfItems.map((item) => item.orderId))];

  const planWhere: Prisma.ProductionPlanWhereInput = {
    deletedAt: null,
    status: { in: ["待生效", "进行中"] },
  };
  const or: Prisma.ProductionPlanWhereInput[] = [];
  if (recalculatedSchedules.length > 0) {
    or.push({ schedules: { some: { scheduleId: { in: recalculatedSchedules } } } });
  }
  if (selfOrderIds.length > 0) {
    or.push({ selfOrders: { some: { selfOrderId: { in: selfOrderIds } } } });
  }
  if (or.length === 0) {
    return { scheduleIds: recalculatedSchedules, planIds: [] };
  }

  const plans = await tx.productionPlan.findMany({
    where: { ...planWhere, OR: or },
    select: {
      id: true,
      code: true,
      cuttingJson: true,
      schedules: { select: { scheduleId: true } },
      selfOrders: { select: { selfOrderId: true } },
    },
  });

  const recalculatedPlans: number[] = [];
  for (const plan of plans) {
    if (hasPlanProgress(plan.cuttingJson)) {
      throw new BomSyncConflictError(
        `生产计划 ${plan.code ?? plan.id} 已有完成确认进度，不能自动重算，请先完成或作废该计划`
      );
    }

    const scheduleIds = plan.schedules.map((ref) => ref.scheduleId);
    // 行级份数调整（含手工追加与历史自产贡献）从现有快照还原，保证重建后份数不丢
    const data = await buildProductionPlanData(
      tx,
      scheduleIds,
      planAdjustmentsFromCuttingJson(plan.cuttingJson)
    );
    await tx.productionPlan.update({
      where: { id: plan.id },
      data: {
        cuttingJson: JSON.parse(JSON.stringify(data.cutting)),
        purchaseJson: JSON.parse(JSON.stringify(data.purchase)),
        sourceScheduleJson: JSON.parse(JSON.stringify(data.sourceSnapshot)),
      },
    });
    recalculatedPlans.push(plan.id);
  }

  return { scheduleIds: recalculatedSchedules, planIds: recalculatedPlans };
}
