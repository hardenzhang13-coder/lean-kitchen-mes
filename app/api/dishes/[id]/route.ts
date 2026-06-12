import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { resolveUsernameToName } from "@/lib/user-resolve";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.dish.findUnique({
    where: { id: Number(id) },
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
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrich seasoningDetails with names
  const minorIds = row.seasoningDetails.filter((d) => d.type === "minor").map((d) => d.sourceId);
  const seasoningIds = row.seasoningDetails.filter((d) => d.type === "seasoning").map((d) => d.sourceId);

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

  const enriched = {
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
    operatorName: await resolveUsernameToName(row.operator),
  };

  return NextResponse.json(enriched);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, cost, status } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const row = await prisma.dish.update({
      where: { id: Number(id) },
      data: {
        name,
        intro: intro || null,
        categoryId: Number(categoryId),
        cuisine: cuisine || null,
        technique: technique || null,
        taste: taste || null,
        portion: portion || "正餐份量",
        season: season || "四季",
        meatType: meatType || null,
        cost: cost != null ? Number(cost) : null,
        status: status || undefined,
        operator,
      },
    });

    await logOperation(req, {
      action: "UPDATE",
      entity: "Dish",
      entityId: row.id,
      description: `更新菜品: ${row.name}`,
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.dish.findUnique({ where: { id: Number(id) } });
    await prisma.dish.delete({ where: { id: Number(id) } });
    await logOperation(req, {
      action: "DELETE",
      entity: "Dish",
      entityId: Number(id),
      description: `删除菜品: ${row?.name || id}`,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
