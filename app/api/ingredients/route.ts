import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { success, created, internalError } from "@/lib/api-response";
import { createIngredientSchema, ingredientQuerySchema } from "@/lib/schemas/ingredient";
import { validateBody, validateQuery } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(ingredientQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { l2Code } = validation.data;
    const where: Prisma.IngredientWhereInput = {};
    if (l2Code) where.l2Code = l2Code;

    const rows = await prisma.ingredient.findMany({
      where,
      orderBy: { id: "asc" },
    });
    return success(rows);
  } catch (err) {
    logger.error({ err }, "GET /api/ingredients failed");
    return internalError("获取原料失败");
  }
}

function generateIngredientCode(lastCode: string | undefined) {
  const num = lastCode ? parseInt(lastCode.split("-")[1] || "0") + 1 : 1;
  return `ING-${String(num).padStart(4, "0")}`;
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
      unit,
      priceUnit,
      purchaseUnit,
      stockUnit,
      purchaseSpec,
      brand,
      latestRefPrice,
      season,
      storage,
    } = validation.data;

    const last = await prisma.ingredient.findFirst({ orderBy: { id: "desc" } });
    const code = generateIngredientCode(last?.code);
    const row = await prisma.ingredient.create({
      data: {
        code,
        name,
        alias: alias ?? null,
        l2Code,
        unit: stockUnit || unit || purchaseUnit || "斤",
        priceUnit: purchaseUnit || priceUnit || unit || "斤",
        purchaseUnit: purchaseUnit || priceUnit || unit || null,
        stockUnit: stockUnit || unit || purchaseUnit || null,
        purchaseSpec: purchaseSpec ?? null,
        brand: brand ?? null,
        latestRefPrice: latestRefPrice ?? null,
        season,
        storage,
      },
    });
    await logOperation(req, {
      action: "CREATE",
      entity: "Ingredient",
      entityId: row.id,
      description: `创建原料: ${row.name}`,
    });
    return created(row);
  } catch (err) {
    logger.error({ err }, "POST /api/ingredients failed");
    return internalError("创建原料失败");
  }
}
