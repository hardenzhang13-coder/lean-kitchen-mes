import { Prisma } from "@prisma/client";

export class ProductionPlanAssignmentError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409 = 400
  ) {
    super(message);
    this.name = "ProductionPlanAssignmentError";
  }
}

/**
 * 锁定并校验生产计划单来源排程。
 * 同一张门店排程只能归属于一个未删除的生产计划单。
 */
export async function lockSchedulesForProductionPlan(
  tx: Prisma.TransactionClient,
  scheduleIds: number[],
  excludePlanId?: number
): Promise<Array<{ id: number; status: string }>> {
  if (scheduleIds.length === 0) {
    throw new ProductionPlanAssignmentError("请至少选择一张排程单");
  }

  const locked = await tx.$queryRaw<Array<{ id: number; status: string }>>(
    Prisma.sql`
      SELECT id, status
      FROM schedules
      WHERE id IN (${Prisma.join(scheduleIds)})
      ORDER BY id
      FOR UPDATE
    `
  );

  if (locked.length !== scheduleIds.length) {
    throw new ProductionPlanAssignmentError("存在无效的排程单");
  }

  if (locked.some((schedule) => schedule.status !== "进行中")) {
    throw new ProductionPlanAssignmentError("只能汇总「进行中」状态的排程单");
  }

  const planWhere: Prisma.ProductionPlanWhereInput = { deletedAt: null };
  if (excludePlanId != null) {
    planWhere.id = { not: excludePlanId };
  }

  const references = await tx.productionPlanSchedule.findMany({
    where: {
      scheduleId: { in: scheduleIds },
      plan: planWhere,
    },
    select: {
      scheduleId: true,
      plan: { select: { code: true, title: true } },
    },
  });

  if (references.length > 0) {
    const reference = references[0];
    throw new ProductionPlanAssignmentError(
      `排程「${reference.plan.code ?? reference.plan.title}」已纳入其他生产计划单，不能重复汇总`,
      409
    );
  }

  return locked;
}

/** 锁定生产计划主记录，保证状态流转串行执行。 */
export async function lockProductionPlan(
  tx: Prisma.TransactionClient,
  planId: number
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`
      SELECT id
      FROM production_plans
      WHERE id = ${planId} AND deleted_at IS NULL
      FOR UPDATE
    `
  );
  return rows.length > 0;
}

/** 生成生产计划单编号：PPL-生产日期-当日序号。 */
export async function nextProductionPlanCode(
  tx: Prisma.TransactionClient,
  planDate: Date
): Promise<string> {
  const ymd =
    planDate.getFullYear() +
    String(planDate.getMonth() + 1).padStart(2, "0") +
    String(planDate.getDate()).padStart(2, "0");
  const dayCount = await tx.productionPlan.count({ where: { planDate } });
  return "PPL-" + ymd + "-" + String(dayCount + 1).padStart(3, "0");
}

/**
 * 生产计划完成时同步全部来源排程状态。
 * 只有整张计划已无待确认行，才允许来源排程进入「已完成」。
 */
export async function syncSourceScheduleStatuses(
  tx: Prisma.TransactionClient,
  scheduleIds: number[],
  planCompleted: boolean
): Promise<number[]> {
  if (!planCompleted || scheduleIds.length === 0) return [];

  const orders = await tx.cuttingOrder.findMany({
    where: { scheduleId: { in: scheduleIds } },
    select: { scheduleId: true, status: true },
  });
  const statusesBySchedule = new Map<number, string[]>();
  for (const order of orders) {
    const statuses = statusesBySchedule.get(order.scheduleId) ?? [];
    statuses.push(order.status);
    statusesBySchedule.set(order.scheduleId, statuses);
  }

  const completedScheduleIds = scheduleIds.filter((scheduleId) => {
    const statuses = statusesBySchedule.get(scheduleId) ?? [];
    return statuses.length > 0 && statuses.every((status) => status !== "pending");
  });

  if (completedScheduleIds.length > 0) {
    await tx.schedule.updateMany({
      where: {
        id: { in: completedScheduleIds },
        status: "进行中",
      },
      data: { status: "已完成" },
    });
  }

  return completedScheduleIds;
}
