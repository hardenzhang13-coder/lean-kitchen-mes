import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.netIngredient.findMany({
    orderBy: { id: "asc" },
    include: { sourceIngredient: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, sourceIngredientId, spec, yieldRate, unitPrice, unit, l2Code, storage } = body;
  try {
    const row = await prisma.netIngredient.create({
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
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
