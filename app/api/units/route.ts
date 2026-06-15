import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const rows = await prisma.unit.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, category } = body;
  try {
    const row = await prisma.unit.create({
      data: { name, category: category || "other" },
    });
    await logOperation(req, { action: "CREATE", entity: "Unit", entityId: row.id, description: `创建: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
