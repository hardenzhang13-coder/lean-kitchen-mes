import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET() {
  const rows = await prisma.minorIngredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

function generateMinorCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SML-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, spec, unitPrice, unit, origin, storage } = body;
  try {
    const last = await prisma.minorIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateMinorCode(last?.code);
    const row = await prisma.minorIngredient.create({
      data: {
        code,
        name,
        spec: spec || null,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit: unit || "10g",
        origin: origin || null,
        storage,
      },
    });
    await logOperation(req, { action: "CREATE", entity: "MinorIngredient", entityId: row.id, description: `创建: ${row.name || row.code}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
