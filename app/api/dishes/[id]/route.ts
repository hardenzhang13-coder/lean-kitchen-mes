import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { success, badRequest, notFound } from "@/lib/server/api-response";
import { updateDishSchema } from "@/lib/server/schemas/dish";
import { validateBody } from "@/lib/server/validate";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { serializeNetIngredient } from "@/lib/server/net-ingredient-utils";
import {
  computeCostPricePerJin,
  resolveRecipeLines,
  serializeSauce,
} from "@/lib/server/sauce-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.dish.findUnique({
    where: { id: Number(id) },
    include: {
      category: { select: { id: true, code: true, name: true } },
      netDetails: {
        include: {
          netIngredient: { select: { id: true, code: true, name: true, unitPrice: true, processingFeePerJin: true, grossMarginRate: true, packageSpec: true, unit: true } },
        },
      },
      minorDetails: {
        include: {
          // 与主料/辅料同口径：附封装规格与加工费，供 serializeNetIngredient 计算价格体系
          netIngredient: { select: { id: true, code: true, name: true, unitPrice: true, processingFeePerJin: true, grossMarginRate: true, packageSpec: true, unit: true } },
        },
      },
      seasoningDetails: true,
      sauceDetails: {
        include: {
              // 附价格体系字段，serializeSauce 注入成本价/出库价（元/斤）
          sauce: {
            select: {
              id: true, code: true, name: true, type: true,
              pricePerJin: true, grossMarginRate: true, processingFeePerJin: true,
              recipeDetails: { select: { lineType: true, refId: true, amountG: true } },
            },
          },
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
    select: { id: true, name: true, alias: true, latestRefPrice: true, pricePerJin: true, purchaseUnit: true },
  });

  const enriched = {
    ...row,
    // 主料/辅料/小料统一附价格体系（净料单价/成本价/标准规格价），前端展示口径一致
    netDetails: row.netDetails.map((d) => ({
      ...d,
      netIngredient: d.netIngredient
        ? serializeNetIngredient(d.netIngredient)
        : d.netIngredient,
    })),
    minorDetails: row.minorDetails.map((d) => ({
      ...d,
      netIngredient: d.netIngredient
        ? serializeNetIngredient(d.netIngredient)
        : d.netIngredient,
    })),
    seasoningDetails: row.seasoningDetails.map((d) => ({
      ...d,
      name: seasonings.find((s) => s.id === d.sourceId)?.name,
      unitPrice: seasonings.find((s) => s.id === d.sourceId)?.latestRefPrice,
      // 每斤单价（元/斤）：调料 BOM 成本口径
      pricePerJin: seasonings.find((s) => s.id === d.sourceId)?.pricePerJin,
      unit: seasonings.find((s) => s.id === d.sourceId)?.purchaseUnit,
    })),
    sauceDetails: await Promise.all(
      row.sauceDetails.map(async (d) => {
        const sauce = d.sauce;
        if (!sauce) return { ...d, sauce };
        let costPrice: number | null;
        if (sauce.type === "外购") {
          costPrice = computeCostPricePerJin({ type: sauce.type, pricePerJin: sauce.pricePerJin });
        } else {
          const resolved = await resolveRecipeLines(
            sauce.recipeDetails.map((l) => ({
              lineType: l.lineType as "net" | "seasoning",
              refId: l.refId,
              amountG: Number(l.amountG),
            }))
          );
          costPrice = computeCostPricePerJin({
            type: sauce.type,
            processingFeePerJin: sauce.processingFeePerJin,
            recipeLines: resolved.map((l) => ({ cost: l.cost, amountG: l.amountG })),
          });
        }
        return { ...d, sauce: serializeSauce(sauce, costPrice) };
      })
    ),
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

    const { name, intro, cuisine, technique, taste, portion, season, meatType, cost, price, status } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const existing = await prisma.dish.findUnique({
      where: { id: Number(id) },
      select: { status: true },
    });
    if (existing?.status === "published") {
      const rest = { name, intro, cuisine, technique, taste, portion, season, meatType, cost, price };
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
    if (portion !== undefined) updateData.portion = portion || "单人份";
    if (season !== undefined) updateData.season = season || "四季";
    if (meatType !== undefined) updateData.meatType = meatType || null;
    if (cost !== undefined) updateData.cost = cost != null ? cost : null;
    if (price !== undefined) updateData.price = price != null ? price : null;
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
