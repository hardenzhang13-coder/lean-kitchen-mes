import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import { createIngredientSchema, ingredientQuerySchema } from "@/lib/server/schemas/ingredient";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";
import { checkDuplicateName } from "@/lib/server/duplicate-check";
import { calcPricePerJin } from "@/lib/shared/spec-parser";
import { getJinFactors } from "@/lib/server/unit-factors";
import { nextCode } from "@/lib/shared/code-gen";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(ingredientQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { l1Code, l2Code, kind, q, page, pageSize } = validation.data;
    const where: Prisma.IngredientWhereInput = { deletedAt: null };
    const categoryFilters: Prisma.IngredientWhereInput[] = [];
    if (l2Code) {
      categoryFilters.push({ l2Code });
    }
    if (l1Code) {
      const children = await prisma.ingredientCategoryL2.findMany({
        where: { parentCode: l1Code },
        select: { code: true },
      });
      categoryFilters.push({ l2Code: { in: children.map((c) => c.code) } });
    }
    // 模块边界过滤：原料清单与调味品清单按 Ingredient.kind 划分（调味品独立体系，不挂分类）
    if (kind) {
      categoryFilters.push({ kind: kind === "raw" ? "food" : "seasoning" });
    }
    if (categoryFilters.length > 0) {
      where.AND = categoryFilters;
    }
    if (q?.trim()) {
      // 食材库列表的筛选范围只限名称字段
      where.name = { contains: q.trim() };
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.ingredient.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/ingredients failed");
    return internalError("获取食材失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createIngredientSchema, body);
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

    const dupCheck = await checkDuplicateName(name);
    if (dupCheck.exists) {
      return NextResponse.json({ error: "食材名称已存在" }, { status: 400 });
    }

    // 食材（food）必须挂二级分类；调味品（seasoning）独立体系，不挂分类
    if (kind === "food" && !l2Code) {
      return badRequest("食材必须选择二级分类");
    }
    const prefix = kind === "seasoning" ? "SEA" : "ING";

    const last = await prisma.ingredient.findFirst({
      where: { code: { startsWith: `${prefix}-` } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = nextCode(prefix, last?.code);
    // 用户未传 pricePerJin 时，按采购规格自动换算；换算不出则为 null（留待手动填写）
    // 换算系数来自单位字典（克/斤换算随字典维护，见 lib/server/unit-factors.ts）
    const jinFactors = await getJinFactors();
    const finalPricePerJin =
      pricePerJin ?? calcPricePerJin(latestRefPrice ?? null, purchaseSpec ?? "", jinFactors, purchaseUnit);

    const row = await prisma.ingredient.create({
      data: {
        code,
        name,
        alias: alias ?? null,
        kind,
        l2Code: kind === "food" ? l2Code : null,
        purchaseUnit: purchaseUnit ?? null,
        stockUnit: stockUnit ?? null,
        unitsPerPurchase: unitsPerPurchase ?? 1,
        purchaseSpec: purchaseSpec ?? null,
        latestRefPrice: latestRefPrice ?? null,
        pricePerJin: finalPricePerJin,
        defaultSupplierId: defaultSupplierId ?? null,
        season: season ?? "四季",
        storage: storage ?? "常温",
      },
    });
    await logOperation(req, {
      action: "CREATE",
      entity: "Ingredient",
      entityId: row.id,
      description: `创建食材: ${row.name}`,
    });
    return created(row);
  } catch (err) {
    logger.error({ err }, "POST /api/ingredients failed");
    return internalError("创建食材失败");
  }
}
