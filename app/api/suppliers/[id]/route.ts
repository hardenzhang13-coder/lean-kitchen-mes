import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, contact, phone, remark } = body;
  try {
    const row = await prisma.supplier.update({
      where: { id: Number(id) },
      data: { name, contact: contact || null, phone: phone || null, remark: remark || null },
    });
    await logOperation(req, { action: "UPDATE", entity: "Supplier", entityId: row.id, description: `更新: ${row.name}` });
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.supplier.findUnique({ where: { id: Number(id) } });
    await prisma.supplier.delete({ where: { id: Number(id) } });
    await logOperation(req, { action: "DELETE", entity: "Supplier", entityId: Number(id), description: `删除: ${row?.name || id}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
