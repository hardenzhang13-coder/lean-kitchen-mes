import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { dashboardWeeklyQuerySchema } from "@/lib/server/schemas/dashboard";
import { logger } from "@/lib/server/logger";
import { round2 } from "@/lib/shared/prepped-stock";

/**
 * 工作台周视图：一周内的门店排程单与生产计划单。
 * 两类单据同口径：菜品/净菜种类数、份数、计划销售额（按菜品当前售价现算）。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(dashboardWeeklyQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { startDate, endDate } = validation.data;

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const [schedules, plans] = await Promise.all([
      prisma.schedule.findMany({
        where: { scheduleDate: { gte: start, lte: end } },
        orderBy: [{ scheduleDate: "asc" }, { createdAt: "asc" }],
        include: {
          store: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              dish: { select: { price: true } },
            },
          },
        },
      }),
      prisma.productionPlan.findMany({
        where: {
          deletedAt: null,
          planDate: { gte: start, lte: end },
        },
        orderBy: [{ planDate: "asc" }, { createdAt: "asc" }],
        include: {
          schedules: {
            select: {
              schedule: {
                select: {
                  items: {
                    select: {
                      quantity: true,
                      dish: { select: { price: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return success({
      schedules: schedules.map((schedule) => {
        const priced = schedule.items.filter((item) => item.dish.price != null);
        return {
          id: schedule.id,
          date: schedule.scheduleDate.toISOString().slice(0, 10),
          status: schedule.status,
          storeName: schedule.store.name,
          dishCount: schedule.items.length,
          totalQuantity: schedule.items.reduce((sum, item) => sum + item.quantity, 0),
          plannedAmount:
            priced.length > 0
              ? round2(
                  priced.reduce(
                    (sum, item) => sum + item.quantity * Number(item.dish.price),
                    0
                  )
                )
              : null,
        };
      }),
      plans: plans.map((plan) => {
        const rows = Array.isArray(plan.cuttingJson)
          ? (plan.cuttingJson as Array<Record<string, unknown>>)
          : [];
        const withPortions = rows.filter(
          (row) => typeof row.portions === "number" && Number.isFinite(row.portions)
        );
        // 计划销售额 = 来源排程的菜品计划额合计，与排程卡同口径
        const sourceItems = plan.schedules.flatMap((ref) => ref.schedule.items);
        const priced = sourceItems.filter((item) => item.dish.price != null);
        return {
          id: plan.id,
          date: plan.planDate.toISOString().slice(0, 10),
          status: plan.status,
          netKinds: rows.length,
          totalPortions:
            withPortions.length > 0
              ? round2(
                  withPortions.reduce((sum, row) => sum + Number(row.portions), 0)
                )
              : null,
          plannedAmount:
            priced.length > 0
              ? round2(
                  priced.reduce(
                    (sum, item) => sum + item.quantity * Number(item.dish.price),
                    0
                  )
                )
              : null,
        };
      }),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/dashboard/weekly failed");
    return internalError("获取工作台周视图失败");
  }
}
