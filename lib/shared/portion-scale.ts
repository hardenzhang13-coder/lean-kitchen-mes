/**
 * 菜品份量规格换算（前后端共用纯函数）。
 * 规则：从份量名称中提取份数，单人份 = 1，一锅10份 = 10；
 * 转化倍率 = 目标份数 ÷ 源份数。
 */

/** 从份量规格中提取份数；无法识别时返回 null */
export function parsePortionCount(portion: string | null | undefined): number | null {
  if (!portion) return null;
  const match = portion.match(/(\d+(?:\.\d+)?)/);
  if (match) return Number(match[1]);
  if (portion.includes("单")) return 1;
  return null;
}

/** 由源/目标份量规格推导转化倍率；无法推导时返回 null */
export function portionScaleFactor(
  source: string | null | undefined,
  target: string | null | undefined
): number | null {
  const sourceCount = parsePortionCount(source);
  const targetCount = parsePortionCount(target);
  if (sourceCount == null || targetCount == null || sourceCount <= 0) return null;
  return Number((targetCount / sourceCount).toFixed(4));
}
