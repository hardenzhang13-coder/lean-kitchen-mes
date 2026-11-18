/**
 * 净料 / 小料 BOM 单份用量的唯一口径：
 * 档案的 packageSpec 就是这道菜的标准规格，BOM 用量必须实时等于它。
 * 仅在 packageSpec 缺失（历史数据）时回退存储的 amountG。
 */
export function resolveNetBomAmountG(amountG: unknown, packageSpec: unknown): number {
  const pkg = Number(packageSpec ?? 0);
  if (Number.isFinite(pkg) && pkg > 0) return pkg;
  const amount = Number(amountG ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
