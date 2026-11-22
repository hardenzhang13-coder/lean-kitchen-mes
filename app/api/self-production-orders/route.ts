import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { paginated, internalError } from "@/lib/server/api-response";
import { selfProductionOrderQuerySchema } from "@/lib/server/schemas/self-production-order";
import { validateQuery } from "@/lib/server/validate";
import { resolveUsernamesToNames } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(selfProductionOrderQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { status, startDate, endDate, q, availableForPlan, excludePlanId, page, pageSize } =
      validation.data;

    const where: Prisma.SelfProductionOrderWhereInput = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.produceDate = {};
      if (startDate) where.produceDate.gte = new Date(startDate);
      if (endDate) where.produceDate.lte = new Date(endDate);
    }
    if (q) where.title = { contains: q };
    if (availableForPlan) {
      const planWhere: Prisma.ProductionPlanWhereInput = { deletedAt: null };
      if (excludePlanId != null) {
        planWhere.id = { not: excludePlanId };
      }
      where.productionPlanRefs = { none: { plan: planWhere } };
    }

    const skip = (page - 1) * pageSize;
    const [rows, totalItems] = await Promise.all([
      prisma.selfProductionOrder.findMany({
        where,
        orderBy: [{ produceDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          items: { select: { portions: true } },
          productionPlanRefs: {
            where: { plan: { deletedAt: null } },
            orderBy: { id: "desc" },
            take: 1,
            select: {
              plan: {
                select: { id: true, code: true, title: true, planDate: true, status: true },
              },
            },
          },
        },
      }),
      prisma.selfProductionOrder.count({ where }),
    ]);

    const nameMap = await resolveUsernamesToNames(
      rows.map((row) => row.operator).filter((value): value is string => !!value)
    );
    const data = rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      produceDate: row.produceDate.toISOString(),
      status: row.status,
      operator: row.operator,
      operatorName: row.operator ? nameMap.get(row.operator) || row.operator : null,
      remark: row.remark,
      createdAt: row.createdAt.toISOString(),
      itemCount: row.items.length,
      totalPortions: Math.round(row.items.reduce((sum, item) => sum + Number(item.portions), 0) * 100) / 100,
      productionPlan: row.productionPlanRefs[0]?.plan ?? null,
    }));

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(data, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/self-production-orders failed");
    return internalError("获取内部生产单失败");
  }
}

