/**
 * BOM 单份用量的唯一口径（净料 / 小料 / 标准化调料共用）：
 * 档案的 packageSpec 就是这道菜的标准规格，BOM 用量必须实时等于它。
 * 仅在 packageSpec 缺失（历史数据）时回退存储的 amountG。
 */
export function resolvePackageSpecAmountG(
  amountG: unknown,
  packageSpec: unknown
): number {
  const pkg = Number(packageSpec ?? 0);
  if (Number.isFinite(pkg) && pkg > 0) return pkg;
  const amount = Number(amountG ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/**
 * 净料 / 小料 BOM 单份用量：
 * 档案的 packageSpec 就是这道菜的标准规格，BOM 用量必须实时等于它。
 * 仅在 packageSpec 缺失（历史数据）时回退存储的 amountG。
 */
export function resolveNetBomAmountG(amountG: unknown, packageSpec: unknown): number {
  return resolvePackageSpecAmountG(amountG, packageSpec);
}
