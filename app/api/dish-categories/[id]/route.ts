import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { updateDishCategorySchema } from "@/lib/server/schemas/dish-category";
import { validateBody } from "@/lib/server/validate";
import { countDishCategoryReferences } from "@/lib/server/category-references";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.dishCategory.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return success(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateDishCategorySchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.dishCategory.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "类别不存在" }, { status: 404 });

    const { code, name, description, isActive } = validation.data;

    // 改编号会使菜品编号前缀语义漂移：被引用时禁止改编号，引导停用
    if (code && code !== existing.code) {
      const refs = await countDishCategoryReferences(existing.id);
      if (refs.total > 0) {
        return NextResponse.json(
          {
            error: `该类别已被 ${refs.total} 个菜品引用，不可修改编号；如不再使用请停用`,
            references: refs.byEntity,
          },
          { status: 400 }
        );
      }
    }

    const row = await prisma.dishCategory.update({
      where: { id: Number(id) },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "DishCategory", entityId: row.id, description: `更新: ${row.name || row.code}` });
    return success(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.dishCategory.findUnique({ where: { id: Number(id) } });
    if (!row) return NextResponse.json({ error: "类别不存在" }, { status: 404 });

    // 被菜品引用的类别禁止物理删除，引导停用
    const refs = await countDishCategoryReferences(row.id);
    if (refs.total > 0) {
      return NextResponse.json(
        {
          error: `该类别已被 ${refs.total} 个菜品引用，不可删除；如不再使用请停用`,
          references: refs.byEntity,
        },
        { status: 400 }
      );
    }

    await prisma.dishCategory.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "DishCategory", entityId: Number(id), description: `删除: ${row.name || row.code}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
