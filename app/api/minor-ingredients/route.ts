import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.minorIngredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, spec, unitPrice, unit, origin, storage } = body;
  try {
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
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
