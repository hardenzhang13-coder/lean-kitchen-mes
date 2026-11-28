import { prisma } from "@/lib/server/prisma";
import { SEASONING_PRODUCT_TYPES } from "@/lib/shared/seasoning-product";

export type IngredientSummaryCounts = {
  /** 食材采购档案（Ingredient.kind = food） */
  raw: number;
  /** 净料规格（2026-11-28 起小料并入净料，不再单独计数） */
  net: number;
  /** 基础调味品原料（Ingredient.kind = seasoning） */
  seasoningBase: number;
  /** 单品调料产物 */
  seasoningItem: number;
  /** 复合调料产物 */
  seasoningCompound: number;
  /** 成品酱料产物 */
  seasoningSauce: number;
  /** 菜品库只汇总单人份基准档案，派生场景规格不计入 */
  dishSinglePortion: number;
};

/**
 * 食材库首页模块明细汇总。
 * 食材/调味品用 Ingredient.kind 划分边界；调味品产物按 SeasoningProduct.productType 精确拆分。
 */
export async function getIngredientSummaryCounts(): Promise<IngredientSummaryCounts> {
  const [basePortionRow, productCounts] = await Promise.all([
    prisma.portionProfile.findFirst({
      where: { isBase: true, isActive: true },
      select: { portion: true },
      orderBy: { sortOrder: "asc" },
    }),
    Promise.all(
      SEASONING_PRODUCT_TYPES.map((productType) =>
        prisma.seasoningProduct.count({
          where: { productType, deletedAt: null },
        })
      )
    ),
  ]);

  const basePortion = basePortionRow?.portion ?? "单人份";

  const [raw, net, seasoningBase, dishSinglePortion] = await Promise.all([
    prisma.ingredient.count({ where: { deletedAt: null, kind: "food" } }),
    prisma.netIngredient.count({ where: { deletedAt: null } }),
    prisma.ingredient.count({ where: { deletedAt: null, kind: "seasoning" } }),
    prisma.dish.count({ where: { portion: basePortion } }),
  ]);

  return {
    raw,
    net,
    seasoningBase,
    seasoningItem: productCounts[0],
    seasoningCompound: productCounts[1],
    seasoningSauce: productCounts[2],
    dishSinglePortion,
  };
}
