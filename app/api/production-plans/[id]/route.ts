import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { logger } from "@/lib/server/logger";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);

  const plan = await prisma.productionPlan.findFirst({
    where: { id: planId, deletedAt: null },
    include: {
      schedules: {
        include: {
          schedule: {
            select: {
              id: true,
              code: true,
              title: true,
              scheduleDate: true,
              items: { select: { quantity: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "生产计划单不存在" }, { status: 404 });

  const operatorName = await resolveUsernameToName(plan.operator);
  return success({
    id: plan.id,
    code: plan.code,
    title: plan.title,
    planDate: plan.planDate.toISOString(),
    status: plan.status,
    operator: plan.operator,
    operatorName,
    createdAt: plan.createdAt.toISOString(),
    cuttingOrders: (Array.isArray(plan.cuttingJson) ? plan.cuttingJson : []).map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        confirmStatus: row.confirmStatus ?? "pending",
        actualPortions: row.actualPortions ?? null,
        remark: row.remark ?? null,
      };
    }),

    purchasePlans: plan.purchaseJson ?? [],
    sourceSchedules: plan.schedules.map((s) => ({
      id: s.schedule.id,
      code: s.schedule.code,
      title: s.schedule.title,
      scheduleDate: s.schedule.scheduleDate.toISOString(),
      totalQuantity: s.schedule.items.reduce((sum, it) => sum + it.quantity, 0),
    })),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  try {
    const existing = await prisma.productionPlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: { status: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "生产计划单不存在" }, { status: 404 });
    if (existing.status !== "待生效") {
      return NextResponse.json({ error: "只有待生效的生产计划单可以删除" }, { status: 400 });
    }
    await prisma.productionPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } });
    await logOperation(req, {
      action: "DELETE",
      entity: "ProductionPlan",
      entityId: planId,
      description: "删除生产计划单: " + existing.title,
    });
    return success({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/production-plans/[id] failed");
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
