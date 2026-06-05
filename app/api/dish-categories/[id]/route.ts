import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.dishCategory.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, name, description } = body;
  try {
    const row = await prisma.dishCategory.update({
      where: { id: Number(id) },
      data: { code, name, description: description || null },
    });
    await logOperation(req, { action: "UPDATE", entity: "DishCategory", entityId: row.id, description: `更新: ${row.name || row.code}` });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.dishCategory.findUnique({ where: { id: Number(id) } });
    await prisma.dishCategory.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "DishCategory", entityId: Number(id), description: `删除: ${row?.name || row?.code || id}` });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
