import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { enrichOperatorNames } from "@/lib/server/user-resolve";
import { created, badRequest, internalError, paginated } from "@/lib/server/api-response";
import { createDishSchema, dishQuerySchema } from "@/lib/server/schemas/dish";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";
import { nextCode } from "@/lib/shared/code-gen";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(dishQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { categoryId, cuisine, technique, meatType, portion, portionGroup, status, q, page, pageSize } = validation.data;

    const where: Prisma.DishWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (cuisine) where.cuisine = cuisine;
    if (technique) where.technique = technique;
    if (meatType) where.meatType = meatType;
    if (portion) {
      where.portion = portion;
    } else if (portionGroup === "single") {
      where.portion = { in: ["小碗菜"] };
    } else if (portionGroup === "canteen") {
      where.portion = { in: ["小碗菜·10份"] };
    } else if (portionGroup === "community") {
      where.portion = { notIn: ["小碗菜", "小碗菜·10份"] };
    }
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.dish.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          name: true,
          intro: true,
          categoryId: true,
          cuisine: true,
          technique: true,
          taste: true,
          portion: true,
          season: true,
          meatType: true,
          cost: true,
          price: true,
          status: true,
          createdAt: true,
          operator: true,
          category: { select: { id: true, code: true, name: true } },
        },
      }),
      prisma.dish.count({ where }),
    ]);

    const costMap = await getCurrentDishCostMap(rows.map((row) => row.id));
    const enriched = await enrichOperatorNames(
      rows.map((row) => ({
        ...row,
        cost: costMap.get(row.id) ?? 0,
      }))
    );
    const totalPages = Math.ceil(totalItems / pageSize);

    return paginated(enriched, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/dishes failed");
    return internalError("获取菜品失败");
  }
}

async function generateDishCode(
  tx: Prisma.TransactionClient,
  categoryCode: string | null | undefined
): Promise<string> {
  // 未分类菜品使用 GEN 前缀，保持编号格式一致
  const prefix = `DSH-${categoryCode || "GEN"}`;
  const last = await tx.dish.findFirst({
    where: { code: { startsWith: `${prefix}-` } },
    orderBy: { code: "desc" },
  });
  return nextCode(prefix, last?.code);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createDishSchema, body);
    if (!validation.success) return validation.response;

    const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, price } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const category = categoryId
      ? await prisma.dishCategory.findUnique({
          where: { id: categoryId },
          select: { code: true },
        })
      : null;
    if (categoryId && !category) {
      return badRequest("菜品类别不存在");
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const row = await prisma.$transaction(
          async (tx) => {
            const code = await generateDishCode(tx, category?.code);
            return tx.dish.create({
              data: {
                code,
                name,
                intro: intro ?? null,
                categoryId: categoryId ?? null,
                cuisine: cuisine ?? null,
                technique: technique ?? null,
                taste: taste ?? null,
                portion,
                season,
                meatType: meatType ?? null,
                price: price ?? null,
                status: "draft",
                operator,
              },
            });
          },
          { isolationLevel: "Serializable" }
        );

        await logOperation(req, {
          action: "CREATE",
          entity: "Dish",
          entityId: row.id,
          description: `创建菜品: ${row.name}`,
        });

        return created(row);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unique constraint")) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    logger.error({ err: lastError }, "生成菜品编码失败");
    return internalError(`生成菜品编码失败，请稍后重试: ${lastError?.message ?? "未知错误"}`);
  } catch (err) {
    logger.error({ err }, "POST /api/dishes failed");
    return internalError("创建菜品失败");
  }
}
