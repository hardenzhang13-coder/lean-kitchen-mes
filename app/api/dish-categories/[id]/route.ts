import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { updateDishCategorySchema } from "@/lib/schemas/dish-category";
import { validateBody } from "@/lib/validate";
import { getErrorMessage } from "@/lib/error-utils";

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

    const { code, name, description } = validation.data;
    const row = await prisma.dishCategory.update({
      where: { id: Number(id) },
      data: { code, name, description: description || null },
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
    await prisma.dishCategory.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "DishCategory", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
