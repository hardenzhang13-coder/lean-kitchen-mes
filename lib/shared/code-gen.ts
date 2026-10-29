// 业务编号生成（共享纯函数）。
// 统一各资源「前缀 + 4 位递增序号」的编码规则，替代此前散落在 5 个 route 里的近似重复实现。

/**
 * 从既有编号取末段数字序号。
 * 兼容多段前缀（如 DSH-CAT-0001 取 0001 → 1）。
 */
export function parseCodeSuffix(code: string | undefined): number {
  if (!code) return 0;
  const last = code.split("-").pop() || "0";
  const num = parseInt(last, 10);
  return Number.isNaN(num) ? 0 : num;
}

/** 由前缀 + 数字序号生成编号（序号补零到 4 位）。 */
export function buildCode(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, "0")}`;
}

/** 根据最后一条编号生成下一条编号（无历史记录则从 1 开始）。 */
export function nextCode(prefix: string, lastCode: string | undefined): string {
  const num = lastCode ? parseCodeSuffix(lastCode) + 1 : 1;
  return buildCode(prefix, num);
}
