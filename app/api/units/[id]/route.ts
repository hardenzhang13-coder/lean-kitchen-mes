import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.unit.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, category } = body;
  try {
    const row = await prisma.unit.update({
      where: { id: Number(id) },
      data: { name, category },
    });
    await logOperation(req, { action: "UPDATE", entity: "Unit", entityId: row.id, description: `更新: ${row.name}` });
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.unit.findUnique({ where: { id: Number(id) } });
    await prisma.unit.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "Unit", entityId: Number(id), description: `删除: ${row?.name || id}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
