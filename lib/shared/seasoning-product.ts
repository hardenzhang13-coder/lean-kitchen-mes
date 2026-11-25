/**
 * 调料产物枚举（前后端共用，唯一真源）。
 *
 * 2026-11-25 调味品升级：单品调料 / 复合调料 / 成品酱料是「标准化产物」的类型，
 * 落在 SeasoningProduct.productType（物理表 standard_seasonings）；
 * 调味品原料（Ingredient.kind = "seasoning"）是原材料层，转化/外购后形成产物。
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

/** 成本口径：transform=转化（来源调味品 + 出成率派生）/ purchase=外购（手填每斤单价） */
export const SEASONING_SOURCE_MODES = ["transform", "purchase"] as const;

export type SeasoningSourceMode = (typeof SEASONING_SOURCE_MODES)[number];

export interface SeasoningSourceModeOption {
  value: SeasoningSourceMode;
  label: string;
  description: string;
}

export const SEASONING_SOURCE_MODE_OPTIONS: readonly SeasoningSourceModeOption[] = [
  {
    value: "transform",
    label: "转化",
    description: "来源调味品 × 出成率派生成本价，与净料转化同构",
  },
  {
    value: "purchase",
    label: "外购",
    description: "成品采购建档，品牌/采购规格 + 手填每斤单价",
  },
] as const;

export function getSeasoningSourceModeOption(
  mode?: string | null
): SeasoningSourceModeOption | null {
  if (!mode) return null;
  return (
    SEASONING_SOURCE_MODE_OPTIONS.find((option) => option.value === mode) ?? null
  );
}

export function isSeasoningSourceMode(mode: unknown): mode is SeasoningSourceMode {
  return (
    typeof mode === "string" &&
    (SEASONING_SOURCE_MODES as readonly string[]).includes(mode)
  );
}
