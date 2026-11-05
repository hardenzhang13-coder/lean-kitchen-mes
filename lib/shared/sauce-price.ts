// 酱料价格计算纯函数（前端/后端共用）。
//
// 价格体系（2026-11-05 会议定稿，与净料同一条链）：
// - 成本价（元/斤）：
//   自制 = 配方总成本 ÷ 投入总克重 × 500（投入即产出，正常计算，无出品克重字段）
//   外购 = 每斤单价（采购规格自动换算，同 lib/shared/spec-parser.ts 的 calcPricePerJin）
// - 出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径，空毛利率 = 0
//
// 配方行成本（元）= 行单价（元/斤）× 用量g ÷ 500
//   净料/小料行单价 = 出库价（含加工费与毛利）；调料行单价 = 每斤单价
// 成本价/出库价均为计算字段不落库，由 API 序列化时注入。

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v as number | string);
  return Number.isNaN(n) ? null : n;
}

/**
 * 配方行成本（元）= 行单价（元/斤）× 用量g ÷ 500。
 * 行单价缺失/非法或用量非法返回 null。
 */
export function calcRecipeLineCost(
  pricePerJin: unknown,
  amountG: unknown
): number | null {
  const price = toNumber(pricePerJin);
  const g = toNumber(amountG);
  if (price == null || price < 0) return null;
  if (g == null || g <= 0) return null;
  return Math.round(((price * g) / 500) * 100) / 100;
}

/**
 * 成本价叠加加工费（元/斤）：与净料「成本价 = 净料单价 + 封装加工费」同语义。
 * 基础成本无效返回 null；加工费空 = 0。
 */
export function applyProcessingFee(
  costPricePerJin: unknown,
  processingFeePerJin: unknown
): number | null {
  const cost = toNumber(costPricePerJin);
  if (cost == null || cost < 0) return null;
  const fee = toNumber(processingFeePerJin) ?? 0;
  if (fee < 0) return null;
  return Math.round((cost + fee) * 100) / 100;
}

/**
 * 自制酱料成本价（元/斤）= 配方行成本合计 ÷ 投入总克重 × 500。
 * 任一行缺少成本（食材无价格）或总克重为 0 返回 null。
 */
export function calcSauceCostPricePerJin(
  lines: Array<{ cost: unknown; amountG: unknown }>
): number | null {
  if (lines.length === 0) return null;
  let totalCost = 0;
  let totalG = 0;
  for (const line of lines) {
    const g = toNumber(line.amountG);
    const c = toNumber(line.cost);
    if (g == null || g <= 0 || c == null) return null;
    totalCost += c;
    totalG += g;
  }
  if (totalG <= 0) return null;
  return Math.round(((totalCost / totalG) * 500) * 100) / 100;
}
