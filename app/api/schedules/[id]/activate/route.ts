import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  try {
    const { existing, updated } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM schedules WHERE id = ${scheduleId} FOR UPDATE`
      );
      const row = await tx.schedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, title: true },
      });
      if (!row) throw new Error("排程不存在");
      if (row.status !== "待生效") {
        throw new Error("只有待生效的排程可以确认");
      }
      const result = await tx.schedule.update({
        where: { id: scheduleId },
        data: { status: "进行中" },
      });
      return { existing: row, updated: result };
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `确认生产计划: ${existing.title}`,
    });

    return success(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === "排程不存在" ? 404 : message.startsWith("只有") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
