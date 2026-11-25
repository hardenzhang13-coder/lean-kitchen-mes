import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { success, badRequest } from "@/lib/server/api-response";
import { checkDuplicateName } from "@/lib/server/duplicate-check";
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
      l2Code,
      purchaseUnit,
      stockUnit,
      unitsPerPurchase,
      purchaseSpec,
      latestRefPrice,
      pricePerJin,
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

    // 食材（food）必须挂二级分类；调味品（seasoning）独立体系，分类恒为 NULL
    const finalKind = kind ?? existing.kind;
    const finalL2Code = finalKind === "food" ? l2Code ?? existing.l2Code : null;
    if (finalKind === "food" && !finalL2Code) {
      return badRequest("食材必须选择二级分类");
    }
    const categoryChanged = finalL2Code !== existing.l2Code;

    let category: { code: string; parentCode: string | null } | null = null;
    let existingCategory: { parentCode: string | null } | null = null;
    if (finalKind === "food") {
      category = await prisma.ingredientCategoryL2.findUnique({
        where: { code: finalL2Code! },
        select: { code: true, parentCode: true },
      });
      if (!category) {
        return badRequest("二级分类不存在");
      }
      existingCategory =
        categoryChanged && existing.l2Code != null
          ? await prisma.ingredientCategoryL2.findUnique({
              where: { code: existing.l2Code },
              select: { parentCode: true },
            })
          : null;
      if (categoryChanged && existing.l2Code != null && !existingCategory) {
        return badRequest("原二级分类不存在，请先修复分类档案");
      }
    }
    const minorBoundaryChanged =
      (category?.parentCode === "MIN") !== (existingCategory?.parentCode === "MIN");

    // 换算系数来自单位字典（见 lib/server/unit-factors.ts）
    const jinFactors = await getJinFactors();
    const result = await prisma.$transaction(async (tx) => {
      // 跨净料/小料边界会改变业务归属；被菜品 BOM 引用的规格必须先解除引用。
      if (minorBoundaryChanged) {
        const referenceCount =
          (await tx.dishNetDetail.count({
            where: { netIngredient: { sourceIngredientId: Number(id), deletedAt: null } },
          })) +
          (await tx.dishMinorDetail.count({
            where: { netIngredient: { sourceIngredientId: Number(id), deletedAt: null } },
          }));
        if (referenceCount > 0) {
          throw new Error("该食材的净料/小料已被菜品引用，不能跨净料/小料分类调整");
        }
      }

      const row = await tx.ingredient.update({
        where: { id: Number(id) },
        data: {
            name: name ?? existing.name,
          alias: alias !== undefined ? alias || null : existing.alias,
          kind: finalKind,
          l2Code: finalL2Code,
          purchaseUnit: purchaseUnit !== undefined ? purchaseUnit ?? null : existing.purchaseUnit,
          stockUnit: stockUnit !== undefined ? stockUnit ?? null : existing.stockUnit,
          unitsPerPurchase: unitsPerPurchase ?? existing.unitsPerPurchase,
          purchaseSpec: purchaseSpec !== undefined ? purchaseSpec || null : existing.purchaseSpec,
          latestRefPrice: latestRefPrice !== undefined ? (latestRefPrice != null ? latestRefPrice : null) : existing.latestRefPrice,
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

      // 分类是来源食材上的弱引用副本：改分类必须同事务级联净料/小料，避免清单分组漂移。
      // 调味品不挂分类（l2Code 恒 NULL），且净料表 l2Code 非空，不做级联。
      let syncedNetCount = 0;
      if (categoryChanged && finalL2Code != null) {
        const synced = await tx.netIngredient.updateMany({
          where: { sourceIngredientId: Number(id), deletedAt: null },
          data: { l2Code: finalL2Code },
        });
        syncedNetCount = synced.count;
      }

      return { row, syncedNetCount };
    });
    const { row, syncedNetCount } = result;
    await logOperation(req, {
      action: "UPDATE",
      entity: "Ingredient",
      entityId: row.id,
      description:
        `更新食材: ${row.name}` +
        (syncedNetCount > 0 ? `；级联更新 ${syncedNetCount} 个净料/小料分类` : ""),
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
