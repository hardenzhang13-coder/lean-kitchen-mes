/**
 * 份量规格枚举与换算（前后端共用纯函数，唯一真源）。
 *
 * 口径（2026-11 食材模块迭代）：
 * - 份量枚举在净料/小料档案与菜品档案之间完全同步，避免建档时填错口径。
 * - 每个枚举值都对应一个「小碗菜等价份数」：小碗菜 = 1，小碗菜·10份 = 10，
 *   社区·2份 = 4，社区·3份 = 6，社区·4份 = 8。
 * - 落库存短值（如「社区·2份」），括号内容只作描述文案，不进数据库。
 */

/** 份量枚举取值（落库值）：供 zod enum 与前端选项共用。 */
export const PORTION_VALUES = [
  "小碗菜",
  "小碗菜·10份",
  "社区·2份",
  "社区·3份",
  "社区·4份",
] as const;

export type PortionValue = (typeof PORTION_VALUES)[number];

/** 份量枚举项：value 为落库值，bowlEquivalent 为小碗菜等价份数。 */
export type PortionOption = {
  value: PortionValue;
  label: string;
  /** 说明文案：等价关系或适用范围 */
  description: string;
  /** 小碗菜等价份数：份量换算的唯一口径 */
  bowlEquivalent: number;
};

export const PORTION_OPTIONS: PortionOption[] = [
  { value: "小碗菜", label: "小碗菜", description: "1 份小碗菜", bowlEquivalent: 1 },
  { value: "小碗菜·10份", label: "小碗菜·10份", description: "10 份小碗菜", bowlEquivalent: 10 },
  { value: "社区·2份", label: "社区·2份", description: "小碗菜 ×4", bowlEquivalent: 4 },
  { value: "社区·3份", label: "社区·3份", description: "小碗菜 ×6", bowlEquivalent: 6 },
  { value: "社区·4份", label: "社区·4份", description: "小碗菜 ×8", bowlEquivalent: 8 },
];

/** 历史份量值：存量菜品迁移前的口径，保留解析兼容。 */
const LEGACY_PORTION_COUNTS: Record<string, number> = {
  单人份: 1,
  一锅10份: 10,
};

/** 份量枚举索引：value → 枚举项。 */
const PORTION_MAP = new Map(PORTION_OPTIONS.map((option) => [option.value, option]));

/** 份量枚举索引（对外）：value → 枚举项，避免各模块重复建 Map。 */
export const PORTION_OPTION_BY_VALUE = PORTION_MAP;

/** 取份量枚举项；非枚举值返回 null。 */
export function getPortionOption(
  portion: string | null | undefined
): PortionOption | null {
  if (!portion) return null;
  return PORTION_MAP.get(portion as PortionValue) ?? null;
}

/** 份量是否为合法枚举值。 */
export function isValidPortion(portion: string | null | undefined): boolean {
  return getPortionOption(portion) != null;
}

/**
 * 从份量规格中提取小碗菜等价份数；无法识别时返回 null。
 * 优先按枚举等价份数解析，其次兼容历史值（单人份 = 1、一锅10份 = 10）。
 */
export function parsePortionCount(portion: string | null | undefined): number | null {
  if (!portion) return null;
  const option = getPortionOption(portion);
  if (option) return option.bowlEquivalent;
  const legacy = LEGACY_PORTION_COUNTS[portion];
  if (legacy != null) return legacy;
  const match = portion.match(/(\d+(?:\.\d+)?)/);
  if (match) return Number(match[1]);
  if (portion.includes("单")) return 1;
  return null;
}

/** 由源/目标份量规格推导转化倍率；无法推导时返回 null */
export function portionScaleFactor(
  source: string | null | undefined,
  target: string | null | undefined
): number | null {
  const sourceCount = parsePortionCount(source);
  const targetCount = parsePortionCount(target);
  if (sourceCount == null || targetCount == null || sourceCount <= 0) return null;
  return Number((targetCount / sourceCount).toFixed(4));
}