import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest, notFound, conflict } from "@/lib/server/api-response";
import { updatePortionProfileSchema } from "@/lib/server/schemas/portion-profile";
import { validateBody } from "@/lib/server/validate";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updatePortionProfileSchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.portionProfile.findUnique({ where: { id: Number(id) } });
    if (!existing) return notFound("份量档案不存在");

    // 单人份是基本单元：完全锁定，不可编辑（含停用），前端隐藏操作按钮仅为体验层
    if (existing.isBase) {
      return badRequest("单人份为基本单元，不可编辑");
    }

    const { portion, scenario, multiplier, isActive } = validation.data;
    const renamed = portion !== undefined && portion !== existing.portion;
    // 业务表（菜品/净料/调料清单）存的是份量标签字符串，与档案弱引用：
    // 改名必须在同一事务内级联，否则菜品库份量分组 Tab 按新标签 IN 过滤会失配
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.portionProfile.update({
        where: { id: Number(id) },
        data: {
          ...(portion !== undefined ? { portion } : {}),
          ...(scenario !== undefined ? { scenario } : {}),
          ...(multiplier !== undefined ? { multiplier } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      if (renamed) {
        await tx.dish.updateMany({
          where: { portion: existing.portion },
          data: { portion },
        });
        await tx.netIngredient.updateMany({
          where: { portion: existing.portion },
          data: { portion },
        });
        await tx.standardSeasoning.updateMany({
          where: { portion: existing.portion },
          data: { portion },
        });
      }
      return updated;
    });
    await logOperation(req, { action: "UPDATE", entity: "PortionProfile", entityId: row.id, description: `更新: ${row.portion}` });
    return success(row);
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return conflict("该份量标签已存在");
    }
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.portionProfile.findUnique({ where: { id: Number(id) } });
    if (!row) return notFound("份量档案不存在");

    // 单人份是基本单元：完全锁定，不可删除
    if (row.isBase) {
      return badRequest("单人份为基本单元，不可删除");
    }

    // 份量档案尚未与业务表打通，无引用检查，直接物理删除
    await prisma.portionProfile.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "PortionProfile", entityId: Number(id), description: `删除: ${row.portion}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
