// 净料价格计算纯函数（前端/后端共用）。
//
// 价格体系（与用户对齐的语义，2026-11-04 会议定稿）：
// - 净料单价（元/斤）= 原料每斤单价 ÷ (出成率/100)，见 lib/shared/spec-parser.ts 的 calcNetUnitPrice
// - 成本价（元/斤）= 净料单价 + 封装加工费（元/斤，空 = 0）
// - 毛利率（%）：每条净料/小料单独设置，空 = 0；采用真毛利率口径
// - 出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，保留 2 位小数
// - 标准规格价格（元/份）= 出库价 × 封装规格(g) ÷ 500（1 斤 = 500g），即每封装单位的出库价
//
// 成本价/出库价/标准规格价格均为计算字段，不落库（无 stale 风险），由 API 序列化时注入。

/**
 * 将 Prisma Decimal / number / string 统一转换为 number，null/undefined/非法值返回 null。
 */
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v as number | string);
  return Number.isNaN(n) ? null : n;
}

/**
 * 成本价（元/斤）= 净料单价 + 封装加工费。
 * 净料单价无效返回 null；加工费空视为 0。
 */
export function calcCostPricePerJin(
  unitPrice: unknown,
  processingFeePerJin: unknown
): number | null {
  const cost = toNumber(unitPrice);
  if (cost == null || cost < 0) return null;
  const fee = toNumber(processingFeePerJin) ?? 0;
  if (fee < 0) return null;
  return Math.round((cost + fee) * 100) / 100;
}

/**
 * 出库价（元/斤）= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径。
 * 毛利率空视为 0（出库价 = 成本价）；必须在 [0, 100)，否则返回 null。
 * 成本价无效返回 null。
 */
export function calcOutPricePerJin(
  costPricePerJin: unknown,
  grossMarginRate: unknown
): number | null {
  const cost = toNumber(costPricePerJin);
  if (cost == null || cost < 0) return null;
  const margin = toNumber(grossMarginRate) ?? 0;
  if (margin < 0 || margin >= 100) return null;
  return Math.round((cost / (1 - margin / 100)) * 100) / 100;
}

/**
 * 标准规格价格（元/份）= 出库价 × 封装规格(g) ÷ 500。
 * 出库价或封装规格缺失/非法返回 null。
 */
export function calcStandardPackagePrice(
  outPricePerJin: unknown,
  packageSpecGrams: unknown
): number | null {
  const outPrice = toNumber(outPricePerJin);
  const grams = toNumber(packageSpecGrams);
  if (outPrice == null || outPrice < 0) return null;
  if (grams == null || grams <= 0) return null;
  return Math.round(((outPrice * grams) / 500) * 100) / 100;
}
