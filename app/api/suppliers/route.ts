import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const rows = await prisma.supplier.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, contact, phone, remark } = body;
  try {
    const row = await prisma.supplier.create({
      data: { name, contact: contact || null, phone: phone || null, remark: remark || null },
    });
    await logOperation(req, { action: "CREATE", entity: "Supplier", entityId: row.id, description: `创建: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
