// 单位换算纯函数（前端/后端共用，无副作用，无 prisma/react 依赖）。
// 换算系数的唯一来源是 units 字典表（服务端 lib/server/unit-factors.ts 查询后
// 由调用处通过 buildJinFactors 注入）；本文件的 DEFAULT_JIN_PER_UNIT 仅为
// 调用方未注入时的兜底默认值，修改字典优先于修改这里。

/**
 * 可换算为"斤"的单位及其系数（含中英文缩写）。
 * 仅这些单位可用于采购规格 → 斤的自动换算；袋/瓶/箱/升等计数或体积单位不参与换算但不阻断。
 */
export const DEFAULT_JIN_PER_UNIT: Record<string, number> = {
  斤: 1,
  两: 0.1,
  克: 0.002,
  g: 0.002,
  千克: 2,
  kg: 2,
  公斤: 2,
};

/** 1 斤的克数（重量展示与换算的基准） */
export const GRAMS_PER_JIN = 500;

/**
 * 由单位字典构建「单位名 → 每斤系数」换算表。
 * 仅纳入带 gramsPerUnit 的重量类单位；非重量单位（袋/瓶/升等）不参与重量换算。
 * gramsPerUnit 接受 Prisma Decimal / number / string，非法值跳过。
 */
export function buildJinFactors(
  units: Array<{ name: string; gramsPerUnit?: unknown }>
): Record<string, number> {
  const factors: Record<string, number> = {};
  for (const u of units) {
    const grams = Number(u.gramsPerUnit);
    if (!u.name || !Number.isFinite(grams) || grams <= 0) continue;
    factors[u.name] = grams / GRAMS_PER_JIN;
  }
  return factors;
}
