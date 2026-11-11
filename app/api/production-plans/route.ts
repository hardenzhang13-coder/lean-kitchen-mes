import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { created, paginated, internalError, error } from "@/lib/server/api-response";
import { createProductionPlanSchema, productionPlanQuerySchema } from "@/lib/server/schemas/production-plan";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { buildProductionPlanData } from "@/lib/server/production-plan-utils";
import {
  lockSchedulesForProductionPlan,
  nextProductionPlanCode,
  ProductionPlanAssignmentError,
} from "@/lib/server/production-plan-assignment";
import { resolveUsernamesToNames } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(productionPlanQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { status, q, startDate, endDate, page, pageSize } = validation.data;

    const where: Prisma.ProductionPlanWhereInput = { deletedAt: null };
    if (status) where.status = status;
    if (q?.trim()) where.title = { contains: q.trim() };
    if (startDate || endDate) {
      where.planDate = {};
      if (startDate) where.planDate.gte = new Date(startDate);
      if (endDate) where.planDate.lte = new Date(endDate);
    }

    const skip = (page - 1) * pageSize;
    const [rows, totalItems] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { schedules: true } } },
      }),
      prisma.productionPlan.count({ where }),
    ]);

    const nameMap = await resolveUsernamesToNames(rows.map((r) => r.operator).filter((x): x is string => !!x));
    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      planDate: r.planDate.toISOString(),
      status: r.status,
      operator: r.operator,
      operatorName: r.operator ? nameMap.get(r.operator) || r.operator : null,
      createdAt: r.createdAt.toISOString(),
      scheduleCount: r._count.schedules,
    }));
    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(data, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/production-plans failed");
    return internalError("获取生产计划单失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createProductionPlanSchema, body);
    if (!validation.success) return validation.response;
    const { title, planDate, scheduleIds } = validation.data;

    const uniqueIds = [...new Set(scheduleIds)];
    const user = getUserFromRequest(req);
    const operator = user?.username || null;
    const planDateObj = new Date(planDate);

    let result: Awaited<ReturnType<typeof prisma.productionPlan.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          await lockSchedulesForProductionPlan(tx, uniqueIds);
          const code = await nextProductionPlanCode(tx, planDateObj);
          const data = await buildProductionPlanData(tx, uniqueIds);
          return await tx.productionPlan.create({
            data: {
              code,
              title: title.trim(),
              planDate: planDateObj,
              status: "待生效",
              operator,
              cuttingJson: JSON.parse(JSON.stringify(data.cutting)),
              purchaseJson: JSON.parse(JSON.stringify(data.purchase)),
              schedules: { create: uniqueIds.map((scheduleId) => ({ scheduleId })) },
            },
          });
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue;
        throw e;
      }
    }
    if (!result) return internalError("创建生产计划单失败");

    await logOperation(req, {
      action: "CREATE",
      entity: "ProductionPlan",
      entityId: result.id,
      description: "创建生产计划单: " + result.title + "（汇总 " + uniqueIds.length + " 张排程单）",
    });
    return created(result);
  } catch (err) {
    if (err instanceof ProductionPlanAssignmentError) {
      return error(err.message, err.status, err.status === 409 ? "CONFLICT" : "BAD_REQUEST");
    }
    logger.error({ err }, "POST /api/production-plans failed");
    return internalError("创建生产计划单失败");
  }
}
