import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import {
  createSeasoningProductSchema,
  seasoningProductQuerySchema,
} from "@/lib/server/schemas/seasoning-product";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { nextCode } from "@/lib/shared/code-gen";
import { logger } from "@/lib/server/logger";
import {
  calculateSeasoningProductUnitPrice,
  serializeSeasoningProduct,
} from "@/lib/server/seasoning-product-utils";

/** 调料产物编号前缀：SP-0001（单品调料 / 复合调料 / 成品酱料同表） */
const CODE_PREFIX = "SP";

const SOURCE_INCLUDE = {
  sourceIngredient: {
    select: {
      id: true,
      code: true,
      name: true,
      alias: true,
      purchaseSpec: true,
      pricePerJin: true,
      seasoningType: true,
    },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(seasoningProductQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { productType, sourceIngredientId, q, page, pageSize } = validation.data;

    const where: Prisma.SeasoningProductWhereInput = { deletedAt: null };
    if (productType) {
      where.productType = productType;
    }
    if (sourceIngredientId) {
      where.sourceIngredientId = sourceIngredientId;
    }
    if (q?.trim()) {
      // 列表筛选范围只限名称字段
      where.name = { contains: q.trim() };
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.seasoningProduct.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: SOURCE_INCLUDE,
      }),
      prisma.seasoningProduct.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows.map(serializeSeasoningProduct), {
      page,
      pageSize,
      totalItems,
      totalPages,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/seasoning-products failed");
    return internalError("获取调料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const validation = validateBody(createSeasoningProductSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      sourceIngredientId,
      yieldRate,
      packageSpec,
      processingFeePerJin,
      grossMarginRate,
      storage,
    } = validation.data;

    if (!name?.trim()) {
      return badRequest("名称不能为空");
    }

    // 产物只能由调味品转化而来；类型继承来源调味品的 seasoningType
    const source = await prisma.ingredient.findFirst({
      where: { id: sourceIngredientId, deletedAt: null, kind: "seasoning" },
      select: { id: true, name: true, seasoningType: true },
    });
    if (!source) {
      return badRequest("来源调味品不存在或已删除");
    }
    if (!source.seasoningType) {
      return badRequest("来源调味品未设置调料分类，请先在调味品档案中选择调料分类");
    }

    const calculated = await calculateSeasoningProductUnitPrice({
      sourceIngredientId: source.id,
      yieldRate,
    });
    if (calculated == null) {
      return badRequest("来源调味品缺少每斤单价，无法派生单价");
    }

    const last = await prisma.seasoningProduct.findFirst({
      where: { code: { startsWith: `${CODE_PREFIX}-` } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = nextCode(CODE_PREFIX, last?.code);

    const row = await prisma.seasoningProduct.create({
      data: {
        code,
        name: name.trim(),
        productType: source.seasoningType,
        sourceIngredientId: source.id,
        yieldRate,
        packageSpec,
        unitPrice: calculated,
        processingFeePerJin: processingFeePerJin ?? null,
        grossMarginRate: grossMarginRate ?? 0,
        storage: storage?.trim() || "常温",
      },
      include: SOURCE_INCLUDE,
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "SeasoningProduct",
      entityId: row.id,
      description: `创建调料产物: ${row.name || row.code}（${row.productType}，封装规格 ${row.packageSpec}g）`,
    });

    return created(serializeSeasoningProduct(row));
  } catch (err) {
    logger.error({ err }, "POST /api/seasoning-products failed");
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建调料失败");
  }
}
