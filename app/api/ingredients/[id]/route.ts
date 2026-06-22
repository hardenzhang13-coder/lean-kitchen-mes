import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { checkDuplicateName } from "@/lib/duplicate-check";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const includeNetIngredients = searchParams.get("includeNetIngredients") === "true";

  const row = await prisma.ingredient.findFirst({
    where: { id: Number(id), deletedAt: null },
    include: includeNetIngredients
      ? {
          netIngredients: {
            where: { deletedAt: null },
            orderBy: { id: "asc" },
          },
        }
      : undefined,
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const {
    name,
    alias,
    l2Code,
    purchaseUnit,
    stockUnit,
    purchaseSpec,
    latestRefPrice,
    season,
    storage,
  } = body;

  const dupCheck = await checkDuplicateName(name, { excludeId: Number(id) });
  if (dupCheck.exists) {
    return NextResponse.json({ error: "食材名称已存在" }, { status: 400 });
  }

  try {
    const existing = await prisma.ingredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "食材不存在或已删除" }, { status: 404 });
    }
    const row = await prisma.ingredient.update({
      where: { id: Number(id) },
      data: {
        name,
        alias: alias || null,
        l2Code,
        purchaseUnit: purchaseUnit ?? null,
        stockUnit: stockUnit ?? null,
        purchaseSpec: purchaseSpec || null,
        latestRefPrice: latestRefPrice != null ? Number(latestRefPrice) : null,
        season: season || "四季",
        storage: storage || "常温",
      },
    });
    await logOperation(req, { action: "UPDATE", entity: "Ingredient", entityId: row.id, description: `更新食材: ${row.name}` });
    return NextResponse.json({ data: row });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.ingredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!row) {
      return NextResponse.json({ error: "食材不存在或已删除" }, { status: 404 });
    }
    await prisma.ingredient.update({
      where: { id: Number(id) },
      data: { deletedAt: new Date() },
    });
    await logOperation(req, { action: "DELETE", entity: "Ingredient", entityId: Number(id), description: `删除食材: ${row.name}` });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
