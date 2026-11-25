import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
import { success, badRequest, notFound, conflict } from "@/lib/server/api-response";
import { updateDishSchema } from "@/lib/server/schemas/dish";
import { validatePortionForUpdate } from "@/lib/server/portion-profile-utils";
import { validateBody } from "@/lib/server/validate";
import { serializeNetIngredient } from "@/lib/server/net-ingredient-utils";
import { serializeSeasoningProduct } from "@/lib/server/seasoning-product-utils";
import { getCurrentDishCostBreakdownMap } from "@/lib/server/dish-costing";
import { resolveNetBomAmountG } from "@/lib/shared/bom-amount";

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
          netIngredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unitPrice: true,
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              packageSpec: true,
              portion: true,
              unit: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      },
      minorDetails: {
        include: {
          // 与主料/辅料同口径：附封装规格与加工费，供 serializeNetIngredient 计算价格体系
          netIngredient: {
            select: {
              id: true,
              code: true,
              name: true,
              unitPrice: true,
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              packageSpec: true,
              portion: true,
              unit: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      },
      seasoningDetails: {
        include: {
          // 新口径行：调料产物（单品调料/复合调料/成品酱料同构），价格体系随档案实时派生
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              productType: true,
              packageSpec: true,
              unitPrice: true,
              yieldRate: true,
              processingFeePerJin: true,
              grossMarginRate: true,
              sourceIngredient: { select: { pricePerJin: true } },
            },
          },
        },
      },
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

  // 旧口径行（specId 空）按 sourceId 补全调味品原料信息，仅 kind=seasoning 有效
  const legacySourceIds = row.seasoningDetails
    .filter((d) => d.specId == null && d.sourceId > 0)
    .map((d) => d.sourceId);
  const seasonings = await prisma.ingredient.findMany({
    where: { id: { in: legacySourceIds }, kind: "seasoning" },
    select: { id: true, name: true, alias: true, latestRefPrice: true, pricePerJin: true, purchaseUnit: true, purchaseSpec: true },
  });

  const currentCost =
    (await getCurrentDishCostBreakdownMap([row.id])).get(row.id) ?? {
      main: 0,
      support: 0,
      minor: 0,
      seasoning: 0,
      sauce: 0,
      total: 0,
    };
  const scheduleRefCount = await prisma.scheduleItem.count({
    where: { dishId: row.id },
  });
  const scheduleRefs =
    scheduleRefCount > 0
      ? await prisma.schedule.findMany({
          where: { items: { some: { dishId: row.id } } },
          orderBy: [{ scheduleDate: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            id: true,
            code: true,
            title: true,
            scheduleDate: true,
            status: true,
            store: { select: { name: true } },
            items: {
              where: { dishId: row.id },
              select: { quantity: true },
              take: 1,
            },
          },
        })
      : [];
  const mainCount = row.netDetails.filter((d) => d.role === "main").length;
  const supportCount = row.netDetails.filter((d) => d.role === "support").length;
  const enriched = {
    ...row,
    cost: currentCost.total,
    costBreakdown: currentCost,
    scheduleRefCount,
    scheduleRefs: scheduleRefs.map((schedule) => ({
      id: schedule.id,
      code: schedule.code,
      title: schedule.title,
      scheduleDate: schedule.scheduleDate,
      status: schedule.status,
      storeName: schedule.store?.name ?? null,
      quantity: schedule.items[0]?.quantity ?? 0,
    })),
    bomSummary: {
      main: mainCount,
      support: supportCount,
      minor: row.minorDetails.length,
      seasoning: row.seasoningDetails.length,
      sauce: row.sauceDetails.length,
      hasMain: mainCount > 0,
      hasSupport: supportCount > 0,
      complete: mainCount > 0 && supportCount > 0,
    },
    // 主料/辅料/小料统一附价格体系（净料单价/成本价/标准规格价），前端展示口径一致
    netDetails: row.netDetails.map((d) => ({
      ...d,
      // 净料 BOM 用量以档案封装规格为唯一真源
      amountG: resolveNetBomAmountG(d.amountG, d.netIngredient?.packageSpec),
      netIngredient: d.netIngredient
        ? serializeNetIngredient(d.netIngredient)
        : d.netIngredient,
    })),
    minorDetails: row.minorDetails.map((d) => ({
      ...d,
      amountG: resolveNetBomAmountG(d.amountG, d.netIngredient?.packageSpec),
      netIngredient: d.netIngredient
        ? serializeNetIngredient(d.netIngredient)
        : d.netIngredient,
    })),
    // 调料双口径：新行 = 产物（价格链实时派生）；旧行 = 直引调味品原料（只读保留）
    seasoningDetails: row.seasoningDetails.map((d) => {
      if (d.specId != null) {
        const product = d.product ? serializeSeasoningProduct(d.product) : null;
        return {
          ...d,
          name: product?.name ?? null,
          productType: product?.productType ?? null,
          unitPrice: product?.unitPrice ?? null,
          pricePerJin: product?.outPricePerJin ?? null,
          costPricePerJin: product?.costPricePerJin ?? null,
          standardPackagePrice: product?.standardPackagePrice ?? null,
          unit: null,
          spec: null,
          portion: null,
        };
      }
      const source = seasonings.find((s) => s.id === d.sourceId);
      return {
        ...d,
        name: source?.name ?? null,
        productType: null,
        unitPrice: source?.latestRefPrice ?? null,
        pricePerJin: source?.pricePerJin ?? null,
        unit: source?.purchaseUnit ?? null,
        spec: source?.purchaseSpec ?? null,
        portion: null,
      };
    }),
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

    const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, price } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const existing = await prisma.dish.findUnique({
      where: { id: Number(id) },
      select: { status: true, portion: true },
    });
    if (!existing) return notFound("菜品不存在");
    if (existing.status !== "draft") {
      const rest = { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, price };
      const hasOtherChanges = Object.values(rest).some((v) => v !== undefined);
      if (hasOtherChanges) {
        return badRequest("已发布或已停用菜品不可修改，请先下架为草稿");
      }
    }

    // 份量须命中份量档案（portion_profiles）；允许保持现值不变
    const effectivePortion = portion !== undefined ? portion || "单人份" : undefined;
    if (effectivePortion !== undefined) {
      const portionError = await validatePortionForUpdate(effectivePortion, existing.portion);
      if (portionError) return badRequest(portionError);
    }

    const updateData: Record<string, unknown> = { operator };
    if (name !== undefined) updateData.name = name;
    if (intro !== undefined) updateData.intro = intro || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (cuisine !== undefined) updateData.cuisine = cuisine || null;
    if (technique !== undefined) updateData.technique = technique || null;
    if (taste !== undefined) updateData.taste = taste || null;
    if (portion !== undefined) updateData.portion = effectivePortion;
    if (season !== undefined) updateData.season = season || "四季";
    if (meatType !== undefined) updateData.meatType = meatType || null;
    if (price !== undefined) updateData.price = price != null ? price : null;

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
    if (!row) return notFound("菜品不存在");
    if (row.status === "published") {
      return badRequest("已发布菜品不可删除，请先下架或停用");
    }
    const scheduleRefCount = await prisma.scheduleItem.count({
      where: { dishId: Number(id) },
    });
    if (scheduleRefCount > 0) {
      return conflict(
        `该菜品已被 ${scheduleRefCount} 个排程引用，不能删除；可改为停用`
      );
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
