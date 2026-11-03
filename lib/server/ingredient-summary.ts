import { prisma } from "@/lib/server/prisma";
import {
  getMinorL2Codes,
  getSeasoningL2Codes,
} from "@/lib/server/category-helpers";

export type IngredientSummaryCounts = {
  raw: number;
  net: number;
  minor: number;
  seasoning: number;
  sauce: number;
};

/**
 * 食材库五类食材统计数（食材库入口卡片使用）。
 * 原料/调料按分类编码区分；净料/小料同属 net_ingredients 表，按二级分类划分。
 */
export async function getIngredientSummaryCounts(): Promise<IngredientSummaryCounts> {
  const [seasoningL2Codes, minorL2Codes] = await Promise.all([
    getSeasoningL2Codes(),
    getMinorL2Codes(),
  ]);
  const netCount =
    minorL2Codes.length > 0
      ? prisma.netIngredient.count({ where: { deletedAt: null, l2Code: { notIn: minorL2Codes } } })
      : prisma.netIngredient.count({ where: { deletedAt: null } });
  const minorCount =
    minorL2Codes.length > 0
      ? prisma.netIngredient.count({ where: { deletedAt: null, l2Code: { in: minorL2Codes } } })
      : Promise.resolve(0);
  const [raw, net, minor, seasoning, sauce] = await Promise.all([
    prisma.ingredient.count({ where: { deletedAt: null, l2Code: { notIn: seasoningL2Codes } } }),
    netCount,
    minorCount,
    prisma.ingredient.count({ where: { deletedAt: null, l2Code: { in: seasoningL2Codes } } }),
    prisma.sauceIngredient.count(),
  ]);
  return { raw, net, minor, seasoning, sauce };
}
