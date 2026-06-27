import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { buildCuttingOrders, buildPurchasePlans } from "@/app/lib/schedule-utils";
import { updateScheduleSchema } from "@/lib/schemas/schedule";
import { validateBody } from "@/lib/validate";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      items: {
        include: {
          dish: {
            select: {
              id: true,
              code: true,
              name: true,
              category: { select: { name: true } },
              cost: true,
            },
          },
        },
      },
      cuttingOrders: { orderBy: [{ l1Code: "asc" }, { l2Code: "asc" }, { itemName: "asc" }] },
      purchasePlans: { orderBy: [{ l2Code: "asc" }, { itemName: "asc" }] },
    },
  });

  if (!schedule) {
    return NextResponse.json({ error: "排程不存在" }, { status: 404 });
  }

  // 获取切配工单的分类名称
  const l1Codes = [...new Set(schedule.cuttingOrders.map((c) => c.l1Code).filter((c): c is string => !!c))];
  const l2Codes = [...new Set(schedule.cuttingOrders.map((c) => c.l2Code).filter((c): c is string => !!c))];
  const [l1Cats, l2Cats] = await Promise.all([
    prisma.ingredientCategoryL1.findMany({ where: { code: { in: l1Codes } }, select: { code: true, name: true } }),
    prisma.ingredientCategoryL2.findMany({ where: { code: { in: l2Codes } }, select: { code: true, name: true } }),
  ]);

  // 获取采购计划的分类名称
  const pL2Codes = [...new Set(schedule.purchasePlans.map((p) => p.l2Code).filter((c): c is string => !!c))];
  const pL2Cats = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: pL2Codes } },
    select: { code: true, name: true },
  });

  const enriched = {
    ...schedule,
    cuttingOrders: schedule.cuttingOrders.map((c) => ({
      ...c,
      l1Name: l1Cats.find((cat) => cat.code === c.l1Code)?.name || c.l1Code || "其他",
      l2Name: l2Cats.find((cat) => cat.code === c.l2Code)?.name || c.l2Code || "小料",
    })),
    purchasePlans: schedule.purchasePlans.map((p) => ({
      ...p,
      l2Name: pL2Cats.find((cat) => cat.code === p.l2Code)?.name || p.l2Code || "—",
    })),
    totalQuantity: schedule.items.reduce((s, it) => s + it.quantity, 0),
    dishCount: schedule.items.length,
  };

  return success(enriched);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);
  const body = await req.json();
  const validation = validateBody(updateScheduleSchema, body);
  if (!validation.success) return validation.response;

  const { title, scheduleDate, scope, items } = validation.data;

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
          scope: scope || undefined,
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
