import { prisma } from "@/lib/server/prisma";

// 食材分类辅助：小料体系仍按二级分类（MIN 子树）派生。
// 调味品边界已独立为 ingredients.kind（2026-11-25 升级），不再依赖 SEA 分类树。

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
