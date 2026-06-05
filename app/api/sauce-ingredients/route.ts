import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.sauceIngredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, brand, recipe, storage, unitPrice, unit } = body;
  try {
    const row = await prisma.sauceIngredient.create({
      data: {
        code,
        name,
        brand,
        recipe: recipe || null,
        storage,
        unitPrice: unitPrice ? Number(unitPrice) : 0,
        unit,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
