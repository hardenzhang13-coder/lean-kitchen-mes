import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { productionBatchQuerySchema } from "@/lib/server/schemas/prepped-stock";
import { round2 } from "@/lib/shared/prepped-stock";
import { logger } from "@/lib/server/logger";

/** 可出库生产批次列表：已完成切配计划单 + 批次余量 > 0 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const validation = validateQuery(productionBatchQuerySchema, searchParams);
  if (!validation.success) return validation.response;
  const { page, pageSize } = validation.data;

  try {
    const batchGroups = await prisma.preppedStockBatch.groupBy({
      by: ["productionPlanId"],
      where: { currentPortions: { gt: 0 } },
      _sum: { currentPortions: true, currentQty: true },
      _count: { _all: true },
    });
    const summaryByPlanId = new Map(
      batchGroups.map((group) => [
        group.productionPlanId,
        {
          itemCount: group._count._all,
          totalPortions: round2(Number(group._sum.currentPortions ?? 0)),
          totalQty: round2(Number(group._sum.currentQty ?? 0)),
        },
      ])
    );
    const planIds = [...summaryByPlanId.keys()];
    const where = {
      id: { in: planIds },
      deletedAt: null,
      status: "已完成",
    };
    const [rows, totalItems] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          code: true,
          title: true,
          planDate: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.productionPlan.count({ where }),
    ]);

    const data = rows.map((plan) => ({
      id: plan.id,
      code: plan.code,
      title: plan.title,
      planDate: plan.planDate.toISOString(),
      status: plan.status,
      createdAt: plan.createdAt.toISOString(),
      ...summaryByPlanId.get(plan.id)!,
    }));

    return paginated(data, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (e) {
    logger.error({ err: e }, "GET production outbound batches failed");
    return internalError("获取生产批次失败");
  }
}
