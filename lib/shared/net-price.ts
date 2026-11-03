// 净料价格计算纯函数（前端/后端共用）。
//
// 价格体系（与用户对齐的语义）：
// - 净料成本价（元/斤）= 原料每斤单价 ÷ (出成率/100)，见 lib/shared/spec-parser.ts 的 calcNetUnitPrice
// - 净料出库价（元/斤）= 成本价 + 封装加工费（元/斤，空 = 0）
// - 标准规格价格（元/份）= 出库价 × 封装规格(g) ÷ 500（1 斤 = 500g），即每封装单位的出库价
//
// 出库价与标准规格价格均为计算字段，不落库（无 stale 风险），由 API 序列化时注入。

/**
 * 将 Prisma Decimal / number / string 统一转换为 number，null/undefined/非法值返回 null。
 */
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v as number | string);
  return Number.isNaN(n) ? null : n;
}

/**
 * 净料出库价（元/斤）= 成本价 + 封装加工费。
 * 成本价无效返回 null；加工费空视为 0。
 */
export function calcOutPricePerJin(
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
