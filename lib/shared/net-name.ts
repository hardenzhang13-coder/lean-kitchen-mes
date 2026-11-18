/**
 * 净料默认名称生成（前后端共用纯函数）。
 *
 * 格式：`原料名称•加工方式•500g`
 * - 「加工方式」是占位词，由用户改成实际方式（如 切片、切丝、称重）
 * - 克数取当前包装规格，缺省按 500g
 */

/** 名称里的加工方式占位词 */
export const NET_NAME_METHOD_PLACEHOLDER = "加工方式";

/** 包装规格缺省值（g） */
export const DEFAULT_PACKAGE_SPEC = 500;

/** 生成净料默认名称；没有来源原料时返回空串 */
export function buildNetIngredientDefaultName(
  sourceName: string | null | undefined,
  packageSpec?: string | number | null
): string {
  const base = sourceName?.trim();
  if (!base) return "";

  const spec = Number(packageSpec);
  const grams =
    Number.isFinite(spec) && spec > 0 ? Math.round(spec) : DEFAULT_PACKAGE_SPEC;

  return `${base}•${NET_NAME_METHOD_PLACEHOLDER}•${grams}g`;
}

/** 判断某个名称是否是自动生成的默认名（用于选来源时决定要不要覆盖） */
export function isDefaultNetIngredientName(name: string | null | undefined): boolean {
  if (!name) return false;
  return (
    name.includes(`•${NET_NAME_METHOD_PLACEHOLDER}•`) &&
    name.trim().endsWith("g")
  );
}
