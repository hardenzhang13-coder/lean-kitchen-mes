import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success } from "@/lib/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheduleId = Number(id);

  try {
    const existing = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      select: { status: true, title: true },
    });
    if (!existing) return NextResponse.json({ error: "排程不存在" }, { status: 404 });
    if (existing.status !== "进行中") {
      return NextResponse.json({ error: "只有进行中的排程可以完成" }, { status: 400 });
    }

    const updated = await prisma.schedule.update({
      where: { id: scheduleId },
      data: { status: "已完成" },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "Schedule",
      entityId: scheduleId,
      description: `完成生产: ${existing.title}`,
    });

    return success(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
