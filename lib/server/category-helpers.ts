import { prisma } from "@/lib/server/prisma";

/**
 * 返回所有属于“调味品”体系的二级分类编码。
 * 即 SEA（调味品）一级分类下的全部子分类（含停用分类，保证历史数据仍被识别）。
 * 注：历史遗留的 GRA-SEA 已于迁移 20261103141514 删除。
 */
export async function getSeasoningL2Codes(): Promise<string[]> {
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: "SEA" },
    select: { code: true },
  });
  return l2Rows.map((r) => r.code);
}

/**
 * 返回所有不属于“调味品”体系的二级分类编码。
 */
export async function getNonSeasoningL2Codes(): Promise<string[]> {
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: { not: "SEA" } },
    select: { code: true },
  });
  return l2Rows.map((r) => r.code);
}

/**
 * 同步判断给定 l2Code 是否属于调味品体系（用于已获取列表的场景）。
 */
export function isSeasoningL2Code(l2Code: string, seasoningL2Codes: string[]): boolean {
  return seasoningL2Codes.includes(l2Code);
}

/**
 * 返回所有属于“小料”体系的二级分类编码。
 */
export async function getMinorL2Codes(): Promise<string[]> {
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: { parentCode: "MIN" },
    select: { code: true },
  });
  return l2Rows.map((r) => r.code);
}

/**
 * 同步判断给定 l2Code 是否属于小料体系（用于已获取列表的场景）。
 */
export function isMinorL2Code(l2Code: string, minorL2Codes: string[]): boolean {
  return minorL2Codes.includes(l2Code);
}
