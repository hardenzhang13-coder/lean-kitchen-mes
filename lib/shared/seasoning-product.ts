/**
 * 调味品类型枚举（前后端共用，唯一真源）。
 *
 * 2026-11-25 复议口径：类型是**调味品**的建档属性（Ingredient.seasoningType，
 * 新增/编辑调味品时选择）；调料产物（SeasoningProduct）只能由「转化」生成，
 * 自动继承来源调味品的类型归档到 productType。三个产物页签只是按类型过滤的视图。
 * 渲染入口见 `app/components/ui/seasoning-type-tag.tsx`（SeasoningTypeTag）。
 */

export const SEASONING_PRODUCT_TYPES = ["单品调料", "复合调料", "成品酱料"] as const;

export type SeasoningProductType = (typeof SEASONING_PRODUCT_TYPES)[number];

export interface SeasoningProductTypeOption {
  value: SeasoningProductType;
  label: string;
  description: string;
}

export const SEASONING_PRODUCT_TYPE_OPTIONS: readonly SeasoningProductTypeOption[] = [
  {
    value: "单品调料",
    label: "单品调料",
    description: "单一调味品标准化转化而来（来源调味品 × 出成率）",
  },
  {
    value: "复合调料",
    label: "复合调料",
    description: "多种调味品调配而成的味型（如干碟蘸料）",
  },
  {
    value: "成品酱料",
    label: "成品酱料",
    description: "可直接使用的成品酱类（如牛肉酱）",
  },
] as const;

export function getSeasoningProductTypeOption(
  type?: string | null
): SeasoningProductTypeOption | null {
  if (!type) return null;
  return (
    SEASONING_PRODUCT_TYPE_OPTIONS.find((option) => option.value === type) ?? null
  );
}

export function isSeasoningProductType(type: unknown): type is SeasoningProductType {
  return (
    typeof type === "string" &&
    (SEASONING_PRODUCT_TYPES as readonly string[]).includes(type)
  );
}
