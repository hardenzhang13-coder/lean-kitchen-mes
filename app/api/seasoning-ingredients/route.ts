import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";

async function findSeasoningL2Code() {
  const l2 = await prisma.ingredientCategoryL2.findFirst({
    where: { name: "调料" },
    select: { code: true },
  });
  if (l2) return l2.code;
  // 兼容旧数据：查找名为“调味品”且父级为米面粮油的二级分类
  const legacy = await prisma.ingredientCategoryL2.findFirst({
    where: { name: "调味品", parent: { name: "米面粮油" } },
    select: { code: true },
  });
  return legacy?.code || "SEA-SEA";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const l2Code = searchParams.get("l2Code");
  const where: Prisma.SeasoningIngredientWhereInput = {};
  if (l2Code) where.l2Code = l2Code;
  const rows = await prisma.seasoningIngredient.findMany({
    where,
    orderBy: { id: "asc" },
  });
  return NextResponse.json(rows);
}

function generateSeasoningCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `SEA-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
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
    const seasoningL2Code = await findSeasoningL2Code();
    const last = await prisma.seasoningIngredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateSeasoningCode(last?.code);
    const price = latestRefPrice != null ? Number(latestRefPrice) : purchasePrice != null ? Number(purchasePrice) : 0;
    const row = await prisma.seasoningIngredient.create({
      data: {
        code,
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
    await logOperation(req, { action: "CREATE", entity: "SeasoningIngredient", entityId: row.id, description: `创建: ${row.name || row.code}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
