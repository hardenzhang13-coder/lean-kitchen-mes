import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { buildCuttingOrders, buildPurchasePlans } from "@/lib/server/schedule-utils";
import { getScheduleDetail } from "@/lib/server/schedule-detail";
import { updateScheduleSchema } from "@/lib/server/schemas/schedule";
import { validateBody } from "@/lib/server/validate";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";

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

  const { title, scheduleDate, storeId, items } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 检查状态
      const existing = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true },
      });
      if (!existing) throw new Error("排程不存在");
      if (existing.status !== "待生效") throw new Error("只有待生效的排程可以修改");

      // 更新基础信息
      const updated = await tx.schedule.update({
        where: { id: scheduleId },
        data: {
          title: title?.trim(),
          scheduleDate: scheduleDate ? new Date(scheduleDate) : undefined,
          storeId: storeId ?? undefined,
        },
      });

      // 如果有菜品变更，重新计算
      if (items && items.length > 0) {
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  try {
    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { status: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "排程不存在" }, { status: 404 });
    if (existing.status !== "待生效") {
      return NextResponse.json({ error: "只有待生效的排程可以删除" }, { status: 400 });
    }

    await prisma.schedule.delete({ where: { id: scheduleId } });

    await logOperation(req, {
      action: "DELETE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `删除排程: ${existing.title}`,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
