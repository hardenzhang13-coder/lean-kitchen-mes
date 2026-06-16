import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

async function findSeasoningL2Code() {
  const codes = await getSeasoningL2Codes();
  return codes[0] || "SEA-SEA";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.seasoningIngredient.findFirst({
    where: { id: Number(id), deletedAt: null },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
    name,
    brand,
    purchaseSpec,
    productSpec,
    purchaseUnit,
    stockUnit,
    latestRefPrice,
    purchasePrice,
    retailPrice,
    storage,
    l2Code,
  } = body;
  try {
    const existing = await prisma.seasoningIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "调料不存在或已删除" }, { status: 404 });
    }
    const seasoningL2Code = await findSeasoningL2Code();
    const price = latestRefPrice != null ? Number(latestRefPrice) : purchasePrice != null ? Number(purchasePrice) : 0;
    const row = await prisma.seasoningIngredient.update({
      where: { id: Number(id) },
      data: {
        name,
        brand,
        productSpec: purchaseSpec || productSpec || null,
        productUnit: purchaseUnit || null,
        retailPrice: retailPrice != null ? Number(retailPrice) : null,
        purchasePrice: price,
        purchaseUnit,
        l2Code: l2Code || seasoningL2Code,
        stockUnit: stockUnit || purchaseUnit || null,
        latestRefPrice: latestRefPrice != null ? Number(latestRefPrice) : null,
        storage: storage || "常温",
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "SeasoningIngredient", entityId: row.id, description: `更新: ${row.name || row.code}` });
    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.seasoningIngredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!row) {
      return NextResponse.json({ error: "调料不存在或已删除" }, { status: 404 });
    }
    await prisma.seasoningIngredient.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() },
    });
    await logOperation(req, { action: "DELETE", entity: "SeasoningIngredient", entityId: Number(id), description: `删除: ${row.name || row.code}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
