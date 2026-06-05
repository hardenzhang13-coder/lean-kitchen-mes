import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.netIngredient.findUnique({
    where: { id: Number(id) },
    include: { sourceIngredient: { select: { id: true, name: true } } },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, name, sourceIngredientId, spec, yieldRate, unitPrice, unit, l2Code, storage } = body;
  try {
    const row = await prisma.netIngredient.update({
      where: { id: Number(id) },
      data: {
        code,
        name,
        sourceIngredientId: Number(sourceIngredientId),
        spec: spec || null,
        yieldRate: yieldRate ? Number(yieldRate) : 0,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit: unit || "500g",
        l2Code,
        storage,
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "NetIngredient", entityId: row.id, description: `更新: ${row.name || row.code}` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.netIngredient.findUnique({ where: { id: Number(id) } });
    await prisma.netIngredient.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "NetIngredient", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
