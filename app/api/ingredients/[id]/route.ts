import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest } from "@/lib/server/api-response";
import { checkDuplicateName } from "@/lib/server/duplicate-check";
import { validateCategoryAssignment } from "@/lib/server/category-validate";
import { updateIngredientSchema } from "@/lib/server/schemas/ingredient";
import { validateBody } from "@/lib/server/validate";
import { calcPricePerJin } from "@/lib/shared/spec-parser";
import { getJinFactors } from "@/lib/server/unit-factors";
import { serializeNetIngredient } from "@/lib/server/net-ingredient-utils";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const includeNetIngredients = searchParams.get("includeNetIngredients") === "true";

  const row = await prisma.ingredient.findFirst({
    where: { id: Number(id), deletedAt: null },
    include: {
      defaultSupplier: {
        select: { id: true, name: true },
      },
      ...(includeNetIngredients
        ? {
            netIngredients: {
              where: { deletedAt: null },
              orderBy: { id: "asc" as const },
            },
          }
        : {}),
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!includeNetIngredients) return success(row);

  return success({
    ...row,
    netIngredients: row.netIngredients.map((item) =>
      serializeNetIngredient({
        ...item,
        sourceIngredient: { pricePerJin: row.pricePerJin },
      })
    ),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const validation = validateBody(updateIngredientSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      alias,
      kind,
      seasoningType,
      l2Code,
      l3Code,
      purchaseUnit,
      stockUnit,
      unitsPerPurchase,
      purchaseSpec,
      latestRefPrice,
      pricePerJin,
      yieldRate,
      season,
      storage,
      defaultSupplierId,
    } = validation.data;

    if (name !== undefined) {
      const dupCheck = await checkDuplicateName(name, { excludeId: Number(id) });
      if (dupCheck.exists) {
        return NextResponse.json({ error: "食材名称已存在" }, { status: 400 });
      }
    }

    const existing = await prisma.ingredient.findFirst({
      where: { id: Number(id), deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "食材不存在或已删除" }, { status: 404 });
    }

    // 食材（food）必须挂二级分类；调味品（seasoning）可挂 domain=seasoning 分类，可空。
    // 显式传 null 清空；kind 切换（域不同）时旧分类自动失效；二级变更时旧三级自动失效
    const finalKind = kind ?? existing.kind;
    const kindChanged = finalKind !== existing.kind;
    const finalL2Code =
      l2Code !== undefined ? l2Code?.trim() || null : kindChanged ? null : existing.l2Code;
    const finalL3Code =
      l3Code !== undefined
        ? l3Code?.trim() || null
        : kindChanged || finalL2Code !== existing.l2Code
          ? null
          : existing.l3Code;
    // 调味品类型同理：仅 kind=seasoning 保留，切回食材时清空
    const finalSeasoningType =
      finalKind === "seasoning"
        ? seasoningType !== undefined
          ? (seasoningType ?? null)
          : existing.seasoningType
        : null;
    if (finalKind === "food" && !finalL2Code) {
      return badRequest("食材必须选择二级分类");
    }
    // 分类归属校验：domain 须与 kind 一致，三级须为二级子级
    const categoryCheck = await validateCategoryAssignment(
      finalL2Code,
      finalL3Code,
      finalKind === "seasoning" ? "seasoning" : "food"
    );
    if (!categoryCheck.ok) {
      return badRequest(categoryCheck.error ?? "分类不合法");
    }
    const categoryChanged = finalL2Code !== existing.l2Code;
    const seasoningTypeChanged = finalSeasoningType !== existing.seasoningType;
    // 换算系数来自单位字典（见 lib/server/unit-factors.ts）
    const jinFactors = await getJinFactors();
    const result = await prisma.$transaction(async (tx) => {
      const row = await tx.ingredient.update({
        where: { id: Number(id) },
        data: {
            name: name ?? existing.name,
          alias: alias !== undefined ? alias || null : existing.alias,
          kind: finalKind,
          l2Code: finalL2Code,
          l3Code: finalL3Code,
          seasoningType: finalSeasoningType,
          purchaseUnit: purchaseUnit !== undefined ? purchaseUnit ?? null : existing.purchaseUnit,
          stockUnit: stockUnit !== undefined ? stockUnit ?? null : existing.stockUnit,
          unitsPerPurchase: unitsPerPurchase ?? existing.unitsPerPurchase,
          purchaseSpec: purchaseSpec !== undefined ? purchaseSpec || null : existing.purchaseSpec,
          latestRefPrice: latestRefPrice !== undefined ? (latestRefPrice != null ? latestRefPrice : null) : existing.latestRefPrice,
          yieldRate: yieldRate !== undefined ? (yieldRate ?? null) : existing.yieldRate,
          defaultSupplierId:
            defaultSupplierId !== undefined ? (defaultSupplierId ?? null) : existing.defaultSupplierId,
          pricePerJin:
            pricePerJin !== undefined
              ? pricePerJin ?? null
              : calcPricePerJin(
                  latestRefPrice !== undefined ? latestRefPrice : existing.latestRefPrice,
                  purchaseSpec !== undefined ? purchaseSpec : existing.purchaseSpec,
                  jinFactors,
                  purchaseUnit !== undefined ? purchaseUnit : existing.purchaseUnit
                ),
          season: season !== undefined ? season || "四季" : existing.season,
          storage: storage !== undefined ? storage || "常温" : existing.storage,
        },
      });

      // 分类是来源食材上的弱引用副本：改分类必须同事务级联净料，避免清单分组漂移。
      // 级联同时清空净料三级（旧三级是原二级子级，二级变更后不再成立，由用户在净料档案重选）。
      // 仅食材域级联（净料表 l2Code 非空且属食材域）；调味品分类变更不影响净料。
      let syncedNetCount = 0;
      if (categoryChanged && finalKind === "food" && finalL2Code != null) {
        const synced = await tx.netIngredient.updateMany({
          where: { sourceIngredientId: Number(id), deletedAt: null },
          data: { l2Code: finalL2Code, l3Code: null },
        });
        syncedNetCount = synced.count;
      }

      // 调味品类型同理：产物类型继承来源调味品，改类型必须同事务级联未删除产物
      let syncedProductCount = 0;
      if (seasoningTypeChanged && finalSeasoningType != null) {
        const synced = await tx.seasoningProduct.updateMany({
          where: { sourceIngredientId: Number(id), deletedAt: null },
          data: { productType: finalSeasoningType },
        });
        syncedProductCount = synced.count;
      }

      return { row, syncedNetCount, syncedProductCount };
    });
    const { row, syncedNetCount, syncedProductCount } = result;
    await logOperation(req, {
      action: "UPDATE",
      entity: "Ingredient",
      entityId: row.id,
      description:
        `更新食材: ${row.name}` +
        (syncedNetCount > 0 ? `；级联更新 ${syncedNetCount} 个净料分类` : "") +
        (syncedProductCount > 0 ? `；级联更新 ${syncedProductCount} 个调料产物类型` : ""),
    });
    return success(row);
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
