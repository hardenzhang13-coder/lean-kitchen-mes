import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  const rows = await prisma.inventory.findMany({
    where: { currentQty: { gt: 0 } },
    include: {
      ingredient: {
        select: {
          id: true,
          name: true,
          code: true,
          l2Code: true,
          unit: true,
        },
      },
      seasoningIngredient: {
        select: {
          id: true,
          name: true,
          code: true,
          l2Code: true,
          stockUnit: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const l2Codes = rows
    .map((r) => r.ingredient?.l2Code ?? r.seasoningIngredient?.l2Code)
    .filter((code): code is string => !!code);

  const l2Categories = await prisma.ingredientCategoryL2.findMany({
    where: { code: { in: l2Codes } },
    select: { code: true, name: true, parentCode: true },
  });

  const l1Codes = l2Categories.map((c) => c.parentCode).filter(Boolean);
  const l1Categories = await prisma.ingredientCategoryL1.findMany({
    where: { code: { in: l1Codes } },
    select: { code: true, name: true },
  });

  const l2NameMap = new Map(l2Categories.map((c) => [c.code, c.name]));
  const l1NameMap = new Map(l1Categories.map((c) => [c.code, c.name]));

  const unified = rows.map((row) => {
    const source = row.ingredient
      ? ({ type: "ingredient" as const, entity: row.ingredient, unitField: row.ingredient.unit })
      : row.seasoningIngredient
        ? ({ type: "seasoning" as const, entity: row.seasoningIngredient, unitField: row.seasoningIngredient.stockUnit })
        : null;

    if (!source) {
      return null;
    }

    const l2Code = source.entity.l2Code;
    const l2Name = l2Code ? l2NameMap.get(l2Code) : undefined;
    const l1Name = l2Code
      ? l1NameMap.get(l2Categories.find((c) => c.code === l2Code)?.parentCode || "")
      : undefined;

    return {
      id: row.id,
      sourceType: source.type,
      sourceId: source.entity.id,
      name: source.entity.name,
      code: source.entity.code,
      l2Code,
      l1Name,
      l2Name,
      currentQty: Number(row.currentQty),
      unit: row.unit || source.unitField || "—",
      updatedAt: row.updatedAt.toISOString(),
    };
  });

  let result = unified.filter((item): item is NonNullable<typeof item> => item !== null);

  if (q) {
    const s = q.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        r.l2Name?.toLowerCase().includes(s) ||
        r.l1Name?.toLowerCase().includes(s)
    );
  }

  return NextResponse.json(result);
}
