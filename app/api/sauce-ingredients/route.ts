import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { paginated, internalError } from "@/lib/server/api-response";
import { sauceIngredientQuerySchema } from "@/lib/server/schemas/sauce-ingredient";
import { validateQuery } from "@/lib/server/validate";
import { computeSauceCostPrices, serializeSauce } from "@/lib/server/sauce-utils";
import type { Prisma } from "@prisma/client";

// 酱料机制已业务剥离（2026-11-25 调味品模块升级）：模型与历史数据只读保留，
// 写入口全部关闭（先例：SelfProductionOrder）。本文件仅保留 GET 供历史 BOM 展示。
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
      // 食材库列表的筛选范围只限名称字段
      where.name = { contains: q.trim() };
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
