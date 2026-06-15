import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const rows = await prisma.dishCategory.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, description } = body;
  try {
    const row = await prisma.dishCategory.create({
      data: { code, name, description: description || null },
    });
    await logOperation(req, { action: "CREATE", entity: "DishCategory", entityId: row.id, description: `创建: ${row.name || row.code}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
