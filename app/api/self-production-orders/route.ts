import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import {
  createSelfProductionOrderSchema,
  selfProductionOrderQuerySchema,
} from "@/lib/server/schemas/self-production-order";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { resolveSelfProductionItems } from "@/lib/server/self-production-order-utils";
import { nextSelfProductionOrderCode } from "@/lib/server/production-plan-assignment";
import { resolveUsernamesToNames } from "@/lib/server/user-resolve";
import { buildSelfProductionOrderTitle } from "@/lib/shared/self-production-title";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createSelfProductionOrderSchema, body);
    if (!validation.success) return validation.response;
    const { produceDate, items, remark } = validation.data;

    const produceDateObj = new Date(produceDate);
    const generatedTitle = buildSelfProductionOrderTitle(produceDate);
    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    let result: Awaited<ReturnType<typeof prisma.selfProductionOrder.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const resolved = await resolveSelfProductionItems(tx, items);
          const code = await nextSelfProductionOrderCode(tx, produceDateObj);
          return await tx.selfProductionOrder.create({
            data: {
              code,
              title: generatedTitle,
              produceDate: produceDateObj,
              status: "待生效",
              operator,
              remark: remark?.trim() || null,
              items: {
                create: resolved.map((item) => ({
                  sourceType: item.sourceType,
                  sourceId: item.sourceId,
                  portions: item.portions,
                })),
              },
            },
          });
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002" && attempt < 4) continue;
        throw e;
      }
    }
    if (!result) return internalError("创建内部生产单失败");

    await logOperation(req, {
      action: "CREATE",
      entity: "SelfProductionOrder",
      entityId: result.id,
      description: "创建内部生产单: " + result.title,
    });
    return created(result);
  } catch (err) {
    logger.warn({ err }, "POST /api/self-production-orders failed");
    return badRequest(err instanceof Error ? err.message : "创建内部生产单失败");
  }
}
