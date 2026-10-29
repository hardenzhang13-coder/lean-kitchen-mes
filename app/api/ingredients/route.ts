import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, internalError } from "@/lib/server/api-response";
import { createIngredientSchema, ingredientQuerySchema } from "@/lib/server/schemas/ingredient";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
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

    const { l2Code, q, page, pageSize } = validation.data;
    const where: Prisma.IngredientWhereInput = { deletedAt: null };
    if (l2Code) {
      where.l2Code = l2Code;
    }
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term } },
        { code: { contains: term } },
        { alias: { contains: term } },
      ];
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
      l2Code,
      purchaseUnit,
      stockUnit,
      purchaseSpec,
      latestRefPrice,
      pricePerJin,
      season,
      storage,
    } = validation.data;

    const dupCheck = await checkDuplicateName(name);
    if (dupCheck.exists) {
      return NextResponse.json({ error: "食材名称已存在" }, { status: 400 });
    }

    const seasoningL2Codes = await getSeasoningL2Codes();
    const prefix = seasoningL2Codes.includes(l2Code) ? "SEA" : "ING";

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
      pricePerJin ?? calcPricePerJin(latestRefPrice ?? null, purchaseSpec ?? "", jinFactors);

    const row = await prisma.ingredient.create({
      data: {
        code,
        name,
        alias: alias ?? null,
        l2Code,
        purchaseUnit: purchaseUnit ?? null,
        stockUnit: stockUnit ?? null,
        purchaseSpec: purchaseSpec ?? null,
        latestRefPrice: latestRefPrice ?? null,
        pricePerJin: finalPricePerJin,
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
