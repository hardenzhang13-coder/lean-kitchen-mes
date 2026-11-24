import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { buildCuttingOrders, buildPurchasePlans } from "@/lib/server/schedule-utils";
import { getScheduleDetail } from "@/lib/server/schedule-detail";
import { updateScheduleSchema } from "@/lib/server/schemas/schedule";
import { validateBody } from "@/lib/server/validate";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { getDishStatusOption } from "@/lib/shared/dish-status";
import { buildScheduleTitle } from "@/lib/shared/schedule-title";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  const detail = await getScheduleDetail(scheduleId);
  if (!detail) {
    return NextResponse.json({ error: "排程不存在" }, { status: 404 });
  }
  return success(detail);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);
  const body = await req.json();
  const validation = validateBody(updateScheduleSchema, body);
  if (!validation.success) return validation.response;

  const { scheduleDate, storeId, items } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM schedules WHERE id = ${scheduleId} FOR UPDATE`
      );
      const existing = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, storeId: true, scheduleDate: true },
      });
      if (!existing) throw new Error("排程不存在");
      if (existing.status !== "待生效") throw new Error("只有待生效的排程可以修改");

      // 标题是派生字段：门店或售卖日期变更后按固定格式重算
      const targetStoreId = storeId ?? existing.storeId;
      const targetDate = scheduleDate ? new Date(scheduleDate) : existing.scheduleDate;
      const targetStore = await tx.store.findUnique({
        where: { id: targetStoreId },
        select: { name: true },
      });
      const generatedTitle = buildScheduleTitle(
        targetStore?.name ?? "未命名门店",
        targetDate.toISOString().slice(0, 10)
      );

      // 更新基础信息
      const updated = await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          title: generatedTitle,
          scheduleDate: scheduleDate ? new Date(scheduleDate) : undefined,
          storeId: storeId ?? undefined,
        },
      });

      // 如果有菜品变更，重新计算
      if (items && items.length > 0) {
        // 新增菜品必须已发布；原本就在该排程中的停用菜品允许保留
        const oldItems = await tx.scheduleItem.findMany({
          where: { scheduleId },
          select: { dishId: true },
        });
        const oldDishIds = new Set(oldItems.map((item) => item.dishId));
        const newDishIds = [...new Set(items.map((item) => item.dishId))];
        const newDishes = await tx.dish.findMany({
          where: { id: { in: newDishIds } },
          select: { id: true, name: true, status: true },
        });
        const newDishById = new Map(newDishes.map((dish) => [dish.id, dish]));
        const missingIds = newDishIds.filter((dishId) => !newDishById.has(dishId));
        if (missingIds.length > 0) {
          throw new Error(`菜品不存在：${missingIds.join("、")}`);
        }
        const unavailable = newDishes.filter(
          (dish) => dish.status !== "published" && !oldDishIds.has(dish.id)
        );
        if (unavailable.length > 0) {
          const names = unavailable
            .map((dish) => {
              const label =
                getDishStatusOption(dish.status)?.label ?? dish.status;
              return `${dish.name}（${label}）`;
            })
            .join("、");
          throw new Error(`以下菜品不可用于排程：${names}`);
        }

        // 删除旧的
        await tx.scheduleItem.deleteMany({ where: { scheduleId } });
        await tx.cuttingOrder.deleteMany({ where: { scheduleId } });
        await tx.purchasePlan.deleteMany({ where: { scheduleId } });

        // 创建新的
        for (const item of items) {
          await tx.scheduleItem.create({
            data: { scheduleId, dishId: item.dishId, quantity: Number(item.quantity) },
          });
        }

        const cuttingData = await buildCuttingOrders(tx, scheduleId, items);
        for (const co of cuttingData) {
          await tx.cuttingOrder.create({ data: co });
        }

        const seasoningL2Codes = await getSeasoningL2Codes();
        const purchaseData = await buildPurchasePlans(tx, scheduleId, items, seasoningL2Codes);
        for (const pp of purchaseData) {
          await tx.purchasePlan.create({ data: pp });
        }
      }

      return updated;
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `修改排程: ${result.title}`,
    });

    return success(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("只有") ? 409 : 400 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  try {
    const existing = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM schedules WHERE id = ${scheduleId} FOR UPDATE`
      );
      const row = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, title: true },
      });
      if (!row) throw new Error("排程不存在");
      if (row.status !== "待生效") {
        throw new Error("只有待生效的排程可以删除");
      }
      // 作废回退的排程仍被已软删的切配计划单经关联表引用（该外键无级联），先解除引用再物理删除
      await tx.productionPlanSchedule.deleteMany({ where: { scheduleId } });
      await tx.schedule.delete({ where: { id: scheduleId } });
      return row;
    });

    await logOperation(req, {
      action: "DELETE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `删除排程: ${existing.title}`,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === "排程不存在" ? 404 : message.startsWith("只有") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
