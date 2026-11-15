import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { buildCuttingOrders, buildPurchasePlans } from "@/lib/server/schedule-utils";
import { enrichOperatorNames } from "@/lib/server/user-resolve";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import { createScheduleSchema, scheduleQuerySchema } from "@/lib/server/schemas/schedule";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { getDishStatusOption } from "@/lib/shared/dish-status";
import { buildScheduleTitle } from "@/lib/shared/schedule-title";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(scheduleQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const {
      status,
      startDate,
      endDate,
      q,
      storeId,
      availableForPlan,
      excludePlanId,
      page,
      pageSize,
    } = validation.data;

    const where: Prisma.ScheduleWhereInput = {};
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;
    if (startDate || endDate) {
      where.scheduleDate = {};
      if (startDate) where.scheduleDate.gte = new Date(startDate);
      if (endDate) where.scheduleDate.lte = new Date(endDate);
    }
    if (q) {
      where.title = { contains: q };
    }
    if (availableForPlan) {
      const planWhere: Prisma.ProductionPlanWhereInput = { deletedAt: null };
      if (excludePlanId != null) {
        planWhere.id = { not: excludePlanId };
      }
      where.productionPlanRefs = {
        none: { plan: planWhere },
      };
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.schedule.findMany({
        where,
        orderBy: [{ scheduleDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
        include: {
          items: {
            include: {
              dish: { select: { id: true, name: true, code: true } },
            },
          },
          store: { select: { id: true, name: true } },
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
          _count: {
            select: { items: true },
          },
        },
      }),
      prisma.schedule.count({ where }),
    ]);

    const enriched = await enrichOperatorNames(
      rows.map((r) => {
        const { productionPlanRefs, ...schedule } = r;
        return {
          ...schedule,
          productionPlan: productionPlanRefs[0]?.plan ?? null,
          totalQuantity: r.items.reduce((s, it) => s + it.quantity, 0),
          dishCount: r._count.items,
        };
      })
    );

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(enriched, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/schedules failed");
    return internalError("获取排程失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createScheduleSchema, body);
    if (!validation.success) return validation.response;

    const { scheduleDate, storeId, items } = validation.data;

    // 排程只能选择已发布菜品；停用/草稿不允许进入新排程
    const dishIds = [...new Set(items.map((item) => item.dishId))];
    const dishes = await prisma.dish.findMany({
      where: { id: { in: dishIds } },
      select: { id: true, name: true, status: true },
    });
    const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
    const missingIds = dishIds.filter((dishId) => !dishById.has(dishId));
    if (missingIds.length > 0) {
      return badRequest(`菜品不存在：${missingIds.join("、")}`);
    }
    const unavailable = dishes.filter((dish) => dish.status !== "published");
    if (unavailable.length > 0) {
      const names = unavailable
        .map((dish) => {
          const label = getDishStatusOption(dish.status)?.label ?? dish.status;
          return `${dish.name}（${label}）`;
        })
        .join("、");
      return badRequest(`以下菜品不可用于新建排程：${names}`);
    }

    const store = await prisma.store.findFirst({
      where: { id: storeId, deletedAt: null },
      select: { id: true, name: true, isActive: true },
    });
    if (!store) return badRequest("门店不存在或已删除");
    if (!store.isActive) return badRequest("门店已停用，不能新建排程");

    // 标题是派生字段：由门店与售卖日期生成，不接受客户端传入
    const generatedTitle = buildScheduleTitle(store.name, scheduleDate);

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    // 排程编号：SCH-生产日期-当日序号（如 SCH-20261107-001），唯一冲突重试
    const scheduleDateObj = new Date(scheduleDate);
    const ymd =
      scheduleDateObj.getFullYear() +
      String(scheduleDateObj.getMonth() + 1).padStart(2, "0") +
      String(scheduleDateObj.getDate()).padStart(2, "0");
    let result: Awaited<ReturnType<typeof prisma.schedule.create>> | null = null;
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      try {
        result = await prisma.$transaction(async (tx) => {
          const dayCount = await tx.schedule.count({ where: { scheduleDate: new Date(scheduleDate) } });
          const code = "SCH-" + ymd + "-" + String(dayCount + 1).padStart(3, "0");
          const schedule = await tx.schedule.create({
            data: {
              code,
              title: generatedTitle,
          scheduleDate: new Date(scheduleDate),
          storeId,
          status: "待生效",
          operator,
        },
      });

      for (const item of items) {
        await tx.scheduleItem.create({
          data: {
            scheduleId: schedule.id,
            dishId: item.dishId,
            quantity: item.quantity,
          },
        });
      }

      const cuttingData = await buildCuttingOrders(tx, schedule.id, items);
      for (const co of cuttingData) {
        await tx.cuttingOrder.create({ data: co });
      }

      const seasoningL2Codes = await getSeasoningL2Codes();
      const purchaseData = await buildPurchasePlans(tx, schedule.id, items, seasoningL2Codes);
      for (const pp of purchaseData) {
        await tx.purchasePlan.create({ data: pp });
      }

          return schedule;
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === "P2002" && attempt < 4) continue;
        throw e;
      }
    }
    if (!result) return internalError("创建排程失败");

    await logOperation(req, {
      action: "CREATE",
      entity: "Schedule",
      entityId: result.id,
      description: `创建排程: ${result.title}`,
    });

    return created(result);
  } catch (err) {
    logger.error({ err }, "POST /api/schedules failed");
    return internalError("创建排程失败");
  }
}
