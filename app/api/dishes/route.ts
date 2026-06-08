import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { getUserFromRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const cuisine = searchParams.get("cuisine");
  const meatType = searchParams.get("meatType");
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const where: any = {};
  if (categoryId) where.categoryId = Number(categoryId);
  if (cuisine) where.cuisine = cuisine;
  if (meatType) where.meatType = meatType;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { code: { contains: q } },
    ];
  }

  const rows = await prisma.dish.findMany({
    where,
    orderBy: { id: "asc" },
    include: {
      category: { select: { id: true, code: true, name: true } },
      netDetails: {
        include: {
          netIngredient: { select: { id: true, code: true, name: true, unitPrice: true, unit: true } },
        },
      },
      seasoningDetails: true,
      sauceDetails: {
        include: {
          sauce: { select: { id: true, code: true, name: true, unitPrice: true, unit: true } },
        },
      },
      processes: { orderBy: [{ stage: "asc" }, { stepNo: "asc" }] },
    },
  });

  // Enrich seasoningDetails with names
  const dishIds = rows.map((r) => r.id);
  const allSeasoningDetails = await prisma.dishSeasoningDetail.findMany({
    where: { dishId: { in: dishIds } },
  });
  const minorIds = allSeasoningDetails.filter((d) => d.type === "minor").map((d) => d.sourceId);
  const seasoningIds = allSeasoningDetails.filter((d) => d.type === "seasoning").map((d) => d.sourceId);

  const [minors, seasonings] = await Promise.all([
    prisma.minorIngredient.findMany({
      where: { id: { in: minorIds } },
      select: { id: true, name: true, unitPrice: true, unit: true },
    }),
    prisma.seasoningIngredient.findMany({
      where: { id: { in: seasoningIds } },
      select: { id: true, name: true, brand: true, purchasePrice: true, purchaseUnit: true },
    }),
  ]);

  const enriched = rows.map((row) => ({
    ...row,
    seasoningDetails: row.seasoningDetails.map((d) => ({
      ...d,
      name:
        d.type === "minor"
          ? minors.find((m) => m.id === d.sourceId)?.name
          : seasonings.find((s) => s.id === d.sourceId)?.name,
      unitPrice:
        d.type === "minor"
          ? minors.find((m) => m.id === d.sourceId)?.unitPrice
          : seasonings.find((s) => s.id === d.sourceId)?.purchasePrice,
      unit:
        d.type === "minor"
          ? minors.find((m) => m.id === d.sourceId)?.unit
          : seasonings.find((s) => s.id === d.sourceId)?.purchaseUnit,
    })),
  }));

  return NextResponse.json(enriched);
}

async function generateDishCode(categoryCode: string) {
  const prefix = `DSH-${categoryCode}-`;
  const last = await prisma.dish.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  const num = last ? parseInt(last.code.replace(prefix, ""), 10) + 1 : 1;
  return `${prefix}${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, status } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const category = await prisma.dishCategory.findUnique({
      where: { id: Number(categoryId) },
      select: { code: true },
    });
    if (!category) {
      return NextResponse.json({ error: "菜品类别不存在" }, { status: 400 });
    }

    const code = await generateDishCode(category.code);

    const row = await prisma.dish.create({
      data: {
        code,
        name,
        intro: intro || null,
        categoryId: Number(categoryId),
        cuisine: cuisine || null,
        technique: technique || null,
        taste: taste || null,
        portion: portion || "正餐份量",
        season: season || "四季",
        meatType: meatType || null,
        status: status || "draft",
        operator,
      },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "Dish",
      entityId: row.id,
      description: `创建菜品: ${row.name}`,
    });

    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
