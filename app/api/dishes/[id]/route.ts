import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { resolveUsernameToName } from "@/lib/user-resolve";
import { success, badRequest, notFound } from "@/lib/api-response";
import { getSeasoningL2Codes } from "@/lib/category-helpers";

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
      minorDetails: {
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
  if (!row) return notFound("菜品不存在");

  // Enrich seasoningDetails with names
  const seasoningIds = row.seasoningDetails.map((d) => d.sourceId);
  const seasoningL2Codes = await getSeasoningL2Codes();

  const seasonings = await prisma.ingredient.findMany({
    where: { id: { in: seasoningIds }, l2Code: { in: seasoningL2Codes } },
    select: { id: true, name: true, alias: true, latestRefPrice: true, purchaseUnit: true },
  });

  const enriched = {
    ...row,
    seasoningDetails: row.seasoningDetails.map((d) => ({
      ...d,
      name: seasonings.find((s) => s.id === d.sourceId)?.name,
      unitPrice: seasonings.find((s) => s.id === d.sourceId)?.latestRefPrice,
      unit: seasonings.find((s) => s.id === d.sourceId)?.purchaseUnit,
    })),
    operatorName: await resolveUsernameToName(row.operator),
  };

  return success(enriched);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, cost, status } = body;

  const user = getUserFromRequest(req);
  const operator = user?.username || null;

  try {
    const existing = await prisma.dish.findUnique({
      where: { id: Number(id) },
      select: { status: true },
    });
    if (existing?.status === "published") {
      const { status: requestedStatus, ...rest } = body;
      if (Object.keys(rest).length > 0 || requestedStatus !== "draft") {
        return badRequest("已发布菜品不可修改，请先下架");
      }
    }

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

    return success(row);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return badRequest(message);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const row = await prisma.dish.findUnique({ where: { id: Number(id) } });
    if (row?.status === "published") {
      return badRequest("已发布菜品不可删除");
    }
    await prisma.dish.delete({ where: { id: Number(id) } });
    await logOperation(req, {
      action: "DELETE",
      entity: "Dish",
      entityId: Number(id),
      description: `删除菜品: ${row?.name || id}`,
    });
    return success({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return badRequest(message);
  }
}
