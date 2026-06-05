import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.ingredient.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, name, alias, l2Code, unit, priceUnit, purchaseSpec, season, storage } = body;
  try {
    const row = await prisma.ingredient.update({
      where: { id: Number(id) },
      data: {
        code,
        name,
        alias: alias || null,
        l2Code,
        unit,
        priceUnit,
        purchaseSpec: purchaseSpec || null,
        season: season || "四季",
        storage,
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "Ingredient", entityId: row.id, description: `更新原料: ${row.name}` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.ingredient.findUnique({ where: { id: Number(id) } });
    await prisma.ingredient.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "Ingredient", entityId: Number(id), description: `删除原料: ${row?.name || id}` });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
