import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { logger } from "@/lib/server/logger";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const planId = Number(id);
  try {
    const existing = await prisma.productionPlan.findFirst({
      where: { id: planId, deletedAt: null },
      select: { status: true },
    });
    if (!existing) return NextResponse.json({ error: "生产计划单不存在" }, { status: 404 });
    if (existing.status !== "待生效") {
      return NextResponse.json({ error: "只有待生效的生产计划单可以确认" }, { status: 400 });
    }
    await prisma.productionPlan.update({ where: { id: planId }, data: { status: "进行中" } });
    await logOperation(req, {
      action: "UPDATE",
      entity: "ProductionPlan",
      entityId: planId,
      description: "确认生产计划单",
    });
    return success({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT activate failed");
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
