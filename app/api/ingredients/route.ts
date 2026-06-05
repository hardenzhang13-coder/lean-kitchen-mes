import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.ingredient.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, name, alias, l2Code, unit, priceUnit, purchaseSpec, season, storage } = body;
  try {
    const row = await prisma.ingredient.create({
      data: {
        code,
        name,
        alias: alias || null,
        l2Code,
        unit,
        priceUnit,
        purchaseSpec: purchaseSpec || null,
        season: season || "四季",
        storage,
      },
    });
    return NextResponse.json(row, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
