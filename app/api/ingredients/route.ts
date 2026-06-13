import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const l2Code = searchParams.get("l2Code");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (l2Code) where.l2Code = l2Code;
  const rows = await prisma.ingredient.findMany({
    where,
    orderBy: { id: "asc" },
  });
  return NextResponse.json(rows);
}

function generateIngredientCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `ING-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    alias,
    l2Code,
    unit,
    priceUnit,
    purchaseUnit,
    stockUnit,
    purchaseSpec,
    brand,
    latestRefPrice,
    season,
    storage,
  } = body;
  try {
    const last = await prisma.ingredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateIngredientCode(last?.code);
    const row = await prisma.ingredient.create({
      data: {
        code,
        name,
        alias: alias || null,
        l2Code,
        unit: stockUnit || unit || purchaseUnit || "斤",
        priceUnit: purchaseUnit || priceUnit || unit || "斤",
        purchaseUnit: purchaseUnit || priceUnit || unit || null,
        stockUnit: stockUnit || unit || purchaseUnit || null,
        purchaseSpec: purchaseSpec || null,
        brand: brand || null,
        latestRefPrice: latestRefPrice != null ? Number(latestRefPrice) : null,
        season: season || "四季",
        storage: storage || "常温",
      },
    });
    await logOperation(req, { action: "CREATE", entity: "Ingredient", entityId: row.id, description: `创建原料: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
