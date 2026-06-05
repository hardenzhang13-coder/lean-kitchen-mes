import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.netIngredient.findMany({
    orderBy: { id: "asc" },
    include: { sourceIngredient: { select: { id: true, name: true } } },
  });
  return NextResponse.json(rows);
}

function generateNetCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `PRD-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, sourceIngredientId, spec, yieldRate, unitPrice, unit, l2Code, storage } = body;
  try {
    const last = await prisma.netIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateNetCode(last?.code);
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
