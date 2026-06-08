import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

const VALID_STAGES = ["初加工", "预处理", "上灶加工", "出锅成品"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dishId = Number(id);
  const body = await req.json();
  const processes: Array<{
    stage: string;
    stepNo: number;
    object: string;
    action: string;
    description?: string;
    tool?: string;
    standard?: string;
  }> = body.processes || [];

  // Validate stages
  for (const p of processes) {
    if (!VALID_STAGES.includes(p.stage)) {
      return NextResponse.json({ error: `无效的阶段: ${p.stage}` }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.dishProcess.deleteMany({ where: { dishId } });
      if (processes.length > 0) {
        await tx.dishProcess.createMany({
          data: processes.map((p) => ({
            dishId,
            stage: p.stage,
            stepNo: p.stepNo,
            object: p.object,
            action: p.action,
            description: p.description || null,
            tool: p.tool || null,
            standard: p.standard || null,
          })),
        });
      }
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "DishProcess",
      entityId: dishId,
      description: `更新菜品加工工艺`,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
