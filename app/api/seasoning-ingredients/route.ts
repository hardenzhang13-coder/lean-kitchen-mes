import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.seasoningIngredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

function generateSeasoningCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SEA-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, brand, productSpec, productUnit, retailPrice, purchasePrice, purchaseUnit, storage } = body;
  try {
    const last = await prisma.seasoningIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateSeasoningCode(last?.code);
    const row = await prisma.seasoningIngredient.create({
      data: {
        code,
        name,
        brand,
        productSpec: productSpec || null,
        productUnit: productUnit || null,
        retailPrice: retailPrice ? Number(retailPrice) : null,
        purchasePrice: purchasePrice ? Number(purchasePrice) : 0,
        purchaseUnit,
        storage,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
