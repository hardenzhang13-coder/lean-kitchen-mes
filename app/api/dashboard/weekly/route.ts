import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { dashboardWeeklyQuerySchema } from "@/lib/server/schemas/dashboard";
import { logger } from "@/lib/server/logger";
import { round2 } from "@/lib/shared/prepped-stock";
import { deriveNetIngredientPrices } from "@/lib/server/net-ingredient-utils";

/**
 * 工作台周视图：一周内的门店排程单与生产计划单。
 * 排程卡金额 = 计划销售额（按菜品当前售价现算）；
 * 切配卡金额 = 净料总金额（切配行净需求 g × 净料出库价 ÷ 500，与出库单同口径）。
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
              id: true,
              quantity: true,
              dish: { select: { name: true, price: true } },
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
      }),
    ]);

    // 净料总金额按当前出库价现算（不信任快照），与出库单口径一致
    const planRows = plans.map((plan) =>
      Array.isArray(plan.cuttingJson)
        ? (plan.cuttingJson as Array<Record<string, unknown>>)
        : []
    );
    const cuttingSourceIds = [
      ...new Set(
        planRows.flat().map((row) => Number(row.sourceId)).filter(Number.isInteger)
      ),
    ];
    const nets = cuttingSourceIds.length
      ? await prisma.netIngredient.findMany({
          where: { id: { in: cuttingSourceIds } },
          select: {
            id: true,
            yieldRate: true,
            processingFeePerJin: true,
            grossMarginRate: true,
            packageSpec: true,
            sourceIngredient: { select: { pricePerJin: true } },
          },
        })
      : [];
    const outPriceById = new Map(
      nets.map((net) => [net.id, deriveNetIngredientPrices(net).outPricePerJin])
    );

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
          // 逐菜品明细：工作台悬浮查看今日售卖菜品
          items: schedule.items.map((item) => ({
            id: item.id,
            dishName: item.dish.name,
            quantity: item.quantity,
            amount:
              item.dish.price != null
                ? round2(item.quantity * Number(item.dish.price))
                : null,
          })),
        };
      }),
      plans: plans.map((plan, index) => {
        const rows = planRows[index];
        const withPortions = rows.filter(
          (row) => typeof row.portions === "number" && Number.isFinite(row.portions)
        );
        // 净料总金额 = Σ 切配行净需求(g) × 净料出库价(元/斤) ÷ 500
        const priced = rows.filter((row) => {
          const price = outPriceById.get(Number(row.sourceId));
          return (
            price != null &&
            typeof row.requiredQty === "number" &&
            Number.isFinite(row.requiredQty)
          );
        });
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
                    (sum, row) =>
                      sum +
                      (Number(row.requiredQty) *
                        (outPriceById.get(Number(row.sourceId)) ?? 0)) /
                        500,
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
