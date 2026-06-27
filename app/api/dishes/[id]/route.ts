import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { resolveUsernameToName } from "@/lib/user-resolve";
import { success, badRequest, notFound } from "@/lib/api-response";
import { updateDishSchema } from "@/lib/schemas/dish";
import { validateBody } from "@/lib/validate";
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
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateDishSchema, body);
    if (!validation.success) return validation.response;

    const { name, intro, cuisine, technique, taste, portion, season, meatType, cost, status } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const existing = await prisma.dish.findUnique({
      where: { id: Number(id) },
      select: { status: true },
    });
    if (existing?.status === "published") {
      const rest = { name, intro, cuisine, technique, taste, portion, season, meatType, cost };
      const hasOtherChanges = Object.values(rest).some((v) => v !== undefined);
      if (hasOtherChanges || status !== "draft") {
        return badRequest("已发布菜品不可修改，请先下架");
      }
    }

    const updateData: Record<string, unknown> = { operator };
    if (name !== undefined) updateData.name = name;
    if (intro !== undefined) updateData.intro = intro || null;
    if (cuisine !== undefined) updateData.cuisine = cuisine || null;
    if (technique !== undefined) updateData.technique = technique || null;
    if (taste !== undefined) updateData.taste = taste || null;
    if (portion !== undefined) updateData.portion = portion || "正餐份量";
    if (season !== undefined) updateData.season = season || "四季";
    if (meatType !== undefined) updateData.meatType = meatType || null;
    if (cost !== undefined) updateData.cost = cost != null ? cost : null;
    if (status !== undefined) updateData.status = status;

    const row = await prisma.dish.update({
      where: { id: Number(id) },
      data: updateData,
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
