import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";
import { enrichOperatorNames } from "@/lib/user-resolve";
import { success, created, badRequest, internalError } from "@/lib/api-response";
import { createDishSchema, dishQuerySchema } from "@/lib/schemas/dish";
import { validateBody, validateQuery } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(dishQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { categoryId, cuisine, meatType, status, q } = validation.data;

    const where: Prisma.DishWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (cuisine) where.cuisine = cuisine;
    if (meatType) where.meatType = meatType;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
      ];
    }

    const rows = await prisma.dish.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        category: { select: { id: true, code: true, name: true } },
        netDetails: {
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

    const dishIds = rows.map((r) => r.id);
    const allSeasoningDetails = await prisma.dishSeasoningDetail.findMany({
      where: { dishId: { in: dishIds } },
    });
    const minorIds = allSeasoningDetails.filter((d) => d.type === "minor").map((d) => d.sourceId);
    const seasoningIds = allSeasoningDetails.filter((d) => d.type === "seasoning").map((d) => d.sourceId);

    const [minors, seasonings] = await Promise.all([
      prisma.minorIngredient.findMany({
        where: { id: { in: minorIds } },
        select: { id: true, name: true, unitPrice: true, unit: true },
      }),
      prisma.seasoningIngredient.findMany({
        where: { id: { in: seasoningIds } },
        select: { id: true, name: true, brand: true, purchasePrice: true, purchaseUnit: true },
      }),
    ]);

    const enriched = await enrichOperatorNames(
      rows.map((row) => ({
        ...row,
        seasoningDetails: row.seasoningDetails.map((d) => ({
          ...d,
          name:
            d.type === "minor"
              ? minors.find((m) => m.id === d.sourceId)?.name
              : seasonings.find((s) => s.id === d.sourceId)?.name,
          unitPrice:
            d.type === "minor"
              ? minors.find((m) => m.id === d.sourceId)?.unitPrice
              : seasonings.find((s) => s.id === d.sourceId)?.purchasePrice,
          unit:
            d.type === "minor"
              ? minors.find((m) => m.id === d.sourceId)?.unit
              : seasonings.find((s) => s.id === d.sourceId)?.purchaseUnit,
        })),
      }))
    );

    return success(enriched);
  } catch (err) {
    logger.error({ err }, "GET /api/dishes failed");
    return internalError("获取菜品失败");
  }
}

async function generateDishCode(tx: Prisma.TransactionClient, categoryCode: string): Promise<string> {
  const prefix = `DSH-${categoryCode}-`;
  const last = await tx.dish.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
  });
  let num = 1;
  if (last) {
    const parsed = parseInt(last.code.replace(prefix, ""), 10);
    num = Number.isNaN(parsed) ? 1 : parsed + 1;
  }
  return `${prefix}${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createDishSchema, body);
    if (!validation.success) return validation.response;

    const { name, intro, categoryId, cuisine, technique, taste, portion, season, meatType, status } =
      validation.data;

    const user = getUserFromRequest(req);
    const operator = user?.username || null;

    const category = await prisma.dishCategory.findUnique({
      where: { id: categoryId },
      select: { code: true },
    });
    if (!category) {
      return badRequest("菜品类别不存在");
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const row = await prisma.$transaction(
          async (tx) => {
            const code = await generateDishCode(tx, category.code);
            return tx.dish.create({
              data: {
                code,
                name,
                intro: intro ?? null,
                categoryId,
                cuisine: cuisine ?? null,
                technique: technique ?? null,
                taste: taste ?? null,
                portion,
                season,
                meatType: meatType ?? null,
                status,
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
