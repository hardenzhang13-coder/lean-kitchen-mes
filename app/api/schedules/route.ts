import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { buildCuttingOrders, buildPurchasePlans } from "@/app/lib/schedule-utils";
import { enrichOperatorNames } from "@/lib/user-resolve";
import { success, created, internalError } from "@/lib/api-response";
import { createScheduleSchema, scheduleQuerySchema } from "@/lib/schemas/schedule";
import { validateBody, validateQuery } from "@/lib/validate";
import { logger } from "@/lib/logger";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(scheduleQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { status, startDate, endDate, q } = validation.data;

    const where: Prisma.ScheduleWhereInput = {};
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (q) {
      where.title = { contains: q };
    }

    const rows = await prisma.schedule.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            dish: { select: { id: true, name: true, code: true } },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    const enriched = await enrichOperatorNames(
      rows.map((r) => ({
        ...r,
        totalQuantity: r.items.reduce((s, it) => s + it.quantity, 0),
        dishCount: r._count.items,
      }))
    );

    return success(enriched);
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

    const { title, scheduleDate, scope, items } = validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.create({
        data: {
          title: title.trim(),
          scheduleDate: new Date(scheduleDate),
          scope: scope || "全部食堂",
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
