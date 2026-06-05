import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.sauceIngredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

function generateSauceCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SAU-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, brand, recipe, storage, unitPrice, unit } = body;
  try {
    const last = await prisma.sauceIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateSauceCode(last?.code);
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
