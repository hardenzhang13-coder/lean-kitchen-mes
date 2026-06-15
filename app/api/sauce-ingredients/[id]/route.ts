import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.sauceIngredient.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, name, brand, recipe, storage, unitPrice, unit } = body;
  try {
    const row = await prisma.sauceIngredient.update({
      where: { id: Number(id) },
      data: {
        code,
        name,
        brand,
        recipe: recipe || null,
        storage,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit,
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "SauceIngredient", entityId: row.id, description: `更新: ${row.name || row.code}` });
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.sauceIngredient.findUnique({ where: { id: Number(id) } });
    await prisma.sauceIngredient.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "SauceIngredient", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
