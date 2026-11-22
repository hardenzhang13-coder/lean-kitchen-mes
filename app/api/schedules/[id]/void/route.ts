import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";

/** 作废进行中的排程单：回退到待生效，恢复可编辑。有完成记录或已纳入切配计划单时拦截。 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  try {
    const { title } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM schedules WHERE id = ${scheduleId} FOR UPDATE`
      );
      const row = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, title: true },
      });
      if (!row) throw new Error("排程不存在");
      if (row.status !== "进行中") {
        throw new Error("只有进行中的排程可以作废");
      }
      const doneOrder = await tx.cuttingOrder.findFirst({
        where: { scheduleId, status: { not: "pending" } },
        select: { id: true },
      });
      if (doneOrder) {
        throw new Error("已有切配完成记录，不能作废；请先完成或处理对应切配计划单");
      }
      const reference = await tx.productionPlanSchedule.findFirst({
        where: { scheduleId, plan: { deletedAt: null } },
        select: { plan: { select: { code: true, title: true } } },
      });
      if (reference) {
        throw new Error(
          `已纳入切配计划单「${reference.plan.code ?? reference.plan.title}」，不能作废`
        );
      }
      await tx.schedule.update({
        where: { id: scheduleId },
        data: { status: "待生效" },
      });
      return { title: row.title };
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `作废排程（回退待生效）: ${title}`,
    });

    return success({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      message === "排程不存在"
        ? 404
        : message.startsWith("只有") || message.startsWith("已有") || message.startsWith("已纳入")
          ? 409
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
