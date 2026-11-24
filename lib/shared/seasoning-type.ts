/**
 * 调味品类型枚举（前后端共用，唯一真源）。
 *
 * 2026-11-24 从食材二级分类（SEA-ITM/SEA-COM/SEA-SAU）独立为 Ingredient 字段
 * `seasoningType`（落库中文标签）：类型是调味品的业务属性，不占食材分类体系。
 * 选填；空 = 基础调味品，只出现在「调味品」页签。渲染入口见
 * `app/components/ui/seasoning-type-tag.tsx`。
 */

export const SEASONING_TYPES = ["单品调料", "复合调料", "成品酱料"] as const;

export type SeasoningType = (typeof SEASONING_TYPES)[number];

export interface SeasoningTypeOption {
  value: SeasoningType;
  label: string;
  description: string;
}

export const SEASONING_TYPE_OPTIONS: readonly SeasoningTypeOption[] = [
  {
    value: "单品调料",
    label: "单品调料",
    description: "盐、糖、酱油等基础单品味型",
  },
  {
    value: "复合调料",
    label: "复合调料",
    description: "由多种单品调配而成的味型",
  },
  {
    value: "成品酱料",
    label: "成品酱料",
    description: "可直接使用的成品酱类",
  },
] as const;

export function getSeasoningTypeOption(
  type?: string | null
): SeasoningTypeOption | null {
  if (!type) return null;
  return (
    SEASONING_TYPE_OPTIONS.find((option) => option.value === type) ?? null
  );
}

export function isSeasoningType(type: unknown): type is SeasoningType {
  return (
    typeof type === "string" &&
    (SEASONING_TYPES as readonly string[]).includes(type)
  );
}
