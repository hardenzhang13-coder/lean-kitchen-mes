import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { success, internalError } from "@/lib/server/api-response";
import { dashboardDailyQuerySchema } from "@/lib/server/schemas/dashboard";
import { validateQuery } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";

/**
 * 工作台某日复盘单：指定日期 + 门店的排程及其售卖数据。
 * 未回录（任一明细 actualSoldQty 为空）时不产出 summary，前端展示"未回录"占位。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(dashboardDailyQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { date, storeId } = validation.data;

    const schedule = await prisma.schedule.findFirst({
      where: { scheduleDate: new Date(date), storeId },
      include: {
        store: { select: { id: true, name: true } },
        items: {
          include: {
            dish: {
              select: {
                id: true,
                name: true,
                portion: true,
                meatType: true,
                price: true,
                cost: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (!schedule) {
      return success({ schedule: null, recorded: false, summary: null, items: [] });
    }

    const items = schedule.items.map((it) => {
      const quantity = it.quantity;
      const sold = it.actualSoldQty != null ? Number(it.actualSoldQty) : null;
      const price = it.dish.price != null ? Number(it.dish.price) : null;
      const cost = it.dish.cost != null ? Number(it.dish.cost) : null;
      const planAmount = price != null ? Number((quantity * price).toFixed(2)) : null;
      const diff = sold != null ? sold - quantity : null;
      const sellRate = sold != null ? sold / quantity : null;
      const amount = sold != null && price != null ? Number((sold * price).toFixed(2)) : null;
      return {
        id: it.id,
        dishId: it.dish.id,
        name: it.dish.name,
        portion: it.dish.portion,
        meatType: it.dish.meatType,
        categoryName: it.dish.category?.name ?? null,
        quantity,
        soldQty: sold,
        diff,
        sellRate,
        price,
        cost,
        planAmount,
        amount,
      };
    });

    const recordedCount = items.filter((i) => i.soldQty != null).length;
    const recorded = items.length > 0 && recordedCount === items.length;

    let summary = null;
    if (recorded) {
      const planQty = items.reduce((s, i) => s + i.quantity, 0);
      const soldQty = items.reduce((s, i) => s + (i.soldQty ?? 0), 0);
      const revenue = items.reduce((s, i) => s + (i.amount ?? 0), 0);
      summary = {
        planQty,
        soldQty,
        sellThrough: planQty > 0 ? Number((soldQty / planQty).toFixed(4)) : null,
        revenue: items.some((i) => i.price != null) ? Number(revenue.toFixed(2)) : null,
      };
    }

    // 已回录按售出率降序（卖得好的在上，问题菜沉底）；未回录保持原计划顺序
    const sorted = recorded
      ? [...items].sort((a, b) => (b.sellRate ?? 0) - (a.sellRate ?? 0))
      : items;

    return success({
      schedule: {
        id: schedule.id,
        title: schedule.title,
        scheduleDate: schedule.scheduleDate,
        status: schedule.status,
      },
      store: schedule.store,
      recorded,
      recordedCount,
      totalCount: items.length,
      summary,
      items: sorted,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/dashboard/daily failed");
    return internalError("获取复盘数据失败");
  }
}
