import { prisma } from "@/lib/prisma";

/**
 * 返回所有属于“调味品”体系的二级分类编码。
 * 包含：
 * - SEA（调味品）下的子分类，如 SEA-SEA（调料）
 * - GRA（米面粮油）下的旧兼容分类 GRA-SEA（调味品）
 */
export async function getSeasoningL2Codes(): Promise<string[]> {
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: {
      OR: [
        { parentCode: "SEA" },
        { code: "GRA-SEA" },
      ],
    },
    select: { code: true },
  });
  return l2Rows.map((r) => r.code);
}

/**
 * 返回所有不属于“调味品”体系的二级分类编码。
 */
export async function getNonSeasoningL2Codes(): Promise<string[]> {
  const l2Rows = await prisma.ingredientCategoryL2.findMany({
    where: {
      AND: [
        { parentCode: { not: "SEA" } },
        { code: { not: "GRA-SEA" } },
      ],
    },
    select: { code: true },
  });
  return l2Rows.map((r) => r.code);
}
