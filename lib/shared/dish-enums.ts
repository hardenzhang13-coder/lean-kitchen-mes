/**
 * 菜品基础信息枚举（前后端共用，唯一真源）。
 *
 * 这些字段在菜品表单与列表筛选中使用；选项集中在这里，避免两处字面量漂移。
 * 注意：服务端 zod 不收紧为枚举，存量数据可能包含自由文本。
 */

export type DishFieldOption = {
  value: string;
  label: string;
};

function toOptions(values: readonly string[]): DishFieldOption[] {
  return values.map((value) => ({ value, label: value }));
}

export const CUISINE_VALUES = [
  "川菜",
  "粤菜",
  "湘菜",
  "鲁菜",
  "苏菜",
  "浙菜",
  "闽菜",
  "徽菜",
  "家常菜",
] as const;

export const CUISINE_OPTIONS = toOptions(CUISINE_VALUES);

export const TECHNIQUE_VALUES = [
  "爆炒",
  "红烧",
  "清蒸",
  "炖煮",
  "煎炸",
  "凉拌",
  "干锅",
  "烧烤",
  "卤制",
  "煲汤",
  "烩",
  "熘",
  "扒",
  "焗",
] as const;

export const TECHNIQUE_OPTIONS = toOptions(TECHNIQUE_VALUES);

export const TASTE_VALUES = [
  "麻辣",
  "咸鲜",
  "酸甜",
  "酸辣",
  "香辣",
  "清淡",
  "酱香",
  "蒜香",
  "椒盐",
  "糖醋",
  "鱼香",
  "蚝油",
] as const;

export const TASTE_OPTIONS = toOptions(TASTE_VALUES);

export const MEAT_TYPE_VALUES = ["荤菜", "素菜", "小荤菜"] as const;

export const MEAT_TYPE_OPTIONS = toOptions(MEAT_TYPE_VALUES);

export const SEASON_VALUES = ["四季", "春", "夏", "秋", "冬"] as const;

export const SEASON_OPTIONS = toOptions(SEASON_VALUES);

/** 取枚举标签；非枚举值原样返回，空值返回 null。 */
export function getDishFieldLabel(
  options: readonly DishFieldOption[],
  value: string | null | undefined
): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? value;
}

/** 值是否落在枚举内（用于展示层分支，不用于拒绝存量数据）。 */
export function isDishFieldValue(
  options: readonly DishFieldOption[],
  value: string | null | undefined
): boolean {
  if (!value) return false;
  return options.some((option) => option.value === value);
}
