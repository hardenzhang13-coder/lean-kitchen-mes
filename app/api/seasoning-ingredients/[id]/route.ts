import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.seasoningIngredient.findUnique({ where: { id: Number(id) } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { code, name, brand, productSpec, productUnit, retailPrice, purchasePrice, purchaseUnit, storage } = body;
  try {
    const row = await prisma.seasoningIngredient.update({
      where: { id: Number(id) },
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
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.seasoningIngredient.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
