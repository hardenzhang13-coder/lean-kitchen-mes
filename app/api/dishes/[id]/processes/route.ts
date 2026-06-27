import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { dishProcessSchema } from "@/lib/schemas/dish-process";
import { validateBody } from "@/lib/validate";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dishId = Number(id);
    const body = await req.json();
    const validation = validateBody(dishProcessSchema, body);
    if (!validation.success) return validation.response;

    const { processes } = validation.data;
    const existing = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { status: true },
    });
    if (existing?.status === "published") {
      return NextResponse.json({ error: "已发布菜品不可修改加工工艺" }, { status: 400 });
    }

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
