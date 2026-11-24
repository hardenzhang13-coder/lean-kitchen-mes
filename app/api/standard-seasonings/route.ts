import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import {
  createStandardSeasoningSchema,
  standardSeasoningQuerySchema,
} from "@/lib/server/schemas/standard-seasoning";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { validatePortionForCreate } from "@/lib/server/portion-profile-utils";
import { nextCode } from "@/lib/shared/code-gen";
import { getSeasoningL2Codes } from "@/lib/server/category-helpers";
import { logger } from "@/lib/server/logger";
import {
  calculateStandardSeasoningUnitPrice,
  serializeStandardSeasoning,
} from "@/lib/server/standard-seasoning-utils";

/** 标准化规格编号前缀：SEA-SP-0001 */
const CODE_PREFIX = "SEA-SP";

async function getL2CodesByL1(l1Code: string): Promise<string[]> {
  const rows = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: l1Code },
    select: { code: true },
  });
  return rows.map((r) => r.code);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(standardSeasoningQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { sourceIngredientId, l1Code, l2Code, q, page, pageSize } = validation.data;

    const where: Prisma.StandardSeasoningWhereInput = { deletedAt: null };

    if (sourceIngredientId) {
      where.sourceIngredientId = sourceIngredientId;
    }
    if (l2Code) {
      where.l2Code = l2Code;
    } else if (l1Code) {
      const l2Codes = await getL2CodesByL1(l1Code);
      where.l2Code = { in: l2Codes };
    }
    if (q?.trim()) {
      // 列表筛选范围只限名称字段
      where.name = { contains: q.trim() };
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.standardSeasoning.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: {
          sourceIngredient: {
            select: {
              id: true,
              name: true,
              alias: true,
              purchaseSpec: true,
              pricePerJin: true,
            },
          },
        },
      }),
      prisma.standardSeasoning.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows.map(serializeStandardSeasoning), {
      page,
      pageSize,
      totalItems,
      totalPages,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/standard-seasonings failed");
    return internalError("获取标准化调料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    // 份量：新建必填，先给出可读提示，形态由 zod 校验，档案合法性由路由层查表
    const rawPortion =
      typeof body === "object" && body !== null && "portion" in body
        ? (body as { portion?: unknown }).portion
        : undefined;
    if (!rawPortion) {
      return badRequest("请选择份量");
    }

    const validation = validateBody(createStandardSeasoningSchema, body);
    if (!validation.success) return validation.response;

    const portionError = await validatePortionForCreate(validation.data.portion);
    if (portionError) return badRequest(portionError);

    const {
      name,
      sourceIngredientId,
      packageSpec,
      portion,
      yieldRate,
      processingFeePerJin,
      grossMarginRate,
      storage,
    } = validation.data;

    if (!name?.trim()) {
      return badRequest("名称不能为空");
    }
    if (!packageSpec) {
      return badRequest("必须填写标准规格（g）");
    }

    // 来源调料必须是 SEA 调味品体系
    const seasoningL2Codes = await getSeasoningL2Codes();
    const source = await prisma.ingredient.findFirst({
      where: { id: sourceIngredientId, deletedAt: null },
      select: { id: true, name: true, l2Code: true, pricePerJin: true },
    });
    if (!source) {
      return badRequest("来源调料不存在或已删除");
    }
    if (!seasoningL2Codes.includes(source.l2Code)) {
      return badRequest("来源调料不属于调味品体系，无法标准化");
    }

    const yieldRateNum = Number(yieldRate);
    if (!yieldRateNum || yieldRateNum <= 0 || yieldRateNum > 500) {
      return badRequest("出成率必须在 0.01-500 之间");
    }

    const calculated = await calculateStandardSeasoningUnitPrice(
      source.id,
      yieldRateNum
    );
    if (calculated == null) {
      return badRequest("来源调料缺少每斤单价，无法计算单价");
    }

    const last = await prisma.standardSeasoning.findFirst({
      where: { code: { startsWith: `${CODE_PREFIX}-` } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = nextCode(CODE_PREFIX, last?.code);

    const row = await prisma.standardSeasoning.create({
      data: {
        code,
        name: name.trim(),
        sourceIngredientId: source.id,
        packageSpec,
        portion,
        yieldRate: yieldRateNum,
        unitPrice: calculated,
        processingFeePerJin: processingFeePerJin ?? null,
        grossMarginRate: grossMarginRate ?? 0,
        // 二级分类继承来源调料
        l2Code: source.l2Code,
        storage: storage?.trim() || "常温",
      },
      include: {
        sourceIngredient: {
          select: {
            id: true,
            name: true,
            alias: true,
            purchaseSpec: true,
            pricePerJin: true,
          },
        },
      },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "StandardSeasoning",
      entityId: row.id,
      description: `创建标准化调料: ${row.name || row.code}（标准规格 ${row.packageSpec}g）`,
    });

    return created(serializeStandardSeasoning(row));
  } catch (err) {
    logger.error({ err }, "POST /api/standard-seasonings failed");
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建标准化调料失败");
  }
}
