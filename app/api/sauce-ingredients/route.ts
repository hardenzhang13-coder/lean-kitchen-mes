import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, badRequest, internalError } from "@/lib/server/api-response";
import {
  createSauceIngredientSchema,
  sauceIngredientQuerySchema,
} from "@/lib/server/schemas/sauce-ingredient";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { nextCode } from "@/lib/shared/code-gen";
import { calcPricePerJin } from "@/lib/shared/spec-parser";
import { getJinFactors } from "@/lib/server/unit-factors";
import {
  computeCostPricePerJin,
  computeSauceCostPrices,
  resolveRecipeLines,
  serializeSauce,
} from "@/lib/server/sauce-utils";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(sauceIngredientQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { q, type, page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SauceIngredientWhereInput = { deletedAt: null };
    if (type) where.type = type;
    if (q?.trim()) {
      const term = q.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: term } },
            { code: { contains: term } },
            { brand: { contains: term } },
          ],
        },
      ];
    }

    const [rows, totalItems] = await Promise.all([
      prisma.sauceIngredient.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: pageSize,
        include: {
          recipeDetails: { select: { amountG: true, cost: true } },
          _count: { select: { dishSauceDetails: true } },
        },
      }),
      prisma.sauceIngredient.count({ where }),
    ]);

    const costMap = await computeSauceCostPrices(rows);
    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(
      rows.map((row) => serializeSauce(row, costMap.get(row.id) ?? null)),
      { page, pageSize, totalItems, totalPages }
    );
  } catch {
    return internalError("获取酱料失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createSauceIngredientSchema, body);
    if (!validation.success) return validation.response;

    const {
      name,
      type,
      brand,
      purchaseSpec,
      purchaseUnit,
      latestRefPrice,
      pricePerJin,
      grossMarginRate,
      processingFeePerJin,
      packageSpec,
      storage,
      remark,
      defaultSupplierId,
      recipeLines,
    } = validation.data;

    if (!name?.trim()) return badRequest("名称不能为空");

    // 外购：未传每斤单价时按采购规格自动换算（同调料逻辑）；换算不出为 null（留待手填）
    let finalPricePerJin: number | null = null;
    if (type === "外购") {
      const jinFactors = await getJinFactors();
      finalPricePerJin =
        pricePerJin ??
        calcPricePerJin(latestRefPrice ?? null, purchaseSpec ?? null, jinFactors, purchaseUnit);
    }

    // 自制：配方为成本来源，行成本按当前价格体系计算
    let resolvedLines: Awaited<ReturnType<typeof resolveRecipeLines>> = [];
    if (type === "自制") {
      if (!recipeLines || recipeLines.length === 0) {
        return badRequest("自制酱料必须至少包含一行配方明细");
      }
      resolvedLines = await resolveRecipeLines(recipeLines);
    }

    const last = await prisma.sauceIngredient.findFirst({
      where: { code: { startsWith: "SAU-" } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const code = nextCode("SAU", last?.code);

    const row = await prisma.sauceIngredient.create({
      data: {
        code,
        name: name.trim(),
        type,
        brand: brand?.trim() || null,
        purchaseSpec: purchaseSpec?.trim() || null,
        purchaseUnit: purchaseUnit?.trim() || null,
        latestRefPrice: latestRefPrice ?? null,
        pricePerJin: finalPricePerJin,
        grossMarginRate: grossMarginRate ?? null,
        processingFeePerJin: processingFeePerJin ?? null,
        packageSpec: packageSpec ?? null,
        storage: storage?.trim() || "常温",
        defaultSupplierId: defaultSupplierId ?? null,
        remark: remark?.trim() || null,
        recipeDetails:
          type === "自制"
            ? {
                create: resolvedLines.map((l) => ({
                  lineType: l.lineType,
                  refId: l.refId,
                  amountG: l.amountG,
                  cost: l.cost,
                })),
              }
            : undefined,
      },
      include: { recipeDetails: true },
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "SauceIngredient",
      entityId: row.id,
      description: `创建${type}酱料: ${row.name || row.code}`,
    });

    const costPrice = computeCostPricePerJin({
      type,
      pricePerJin: row.pricePerJin,
      processingFeePerJin: row.processingFeePerJin,
      recipeLines: resolvedLines.map((l) => ({ cost: l.cost, amountG: l.amountG })),
    });
    return created(serializeSauce(row, costPrice));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return badRequest(message || "创建酱料失败");
  }
}
