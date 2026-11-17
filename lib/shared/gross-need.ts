/**
 * 毛料需求(g) = 净需求(g) × 100 ÷ 出成率(%)。
 * 出成率缺失或 ≤0 时按 100% 退化（与排程采购口径一致）。
 */
export function calcGrossNeedGrams(netNeedG: number, yieldRate: number): number {
  return yieldRate > 0 ? (netNeedG * 100) / yieldRate : netNeedG;
}
