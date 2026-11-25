/**
 * 份量换算（前后端共用纯函数）。
 *
 * 唯一真源：份量档案表 portion_profiles（设置模块「份量」，迁移 20261123083624）。
 * 倍率新口径（2026-11-24）：份量 = 单人份 × 倍率（multiplier）；
 * 转化倍率 = 目标行 multiplier ÷ 源行 multiplier。旧 bowlEquivalent（社区 2N）口径作废。
 *
 * 本文件不再持有静态枚举：选项列表由服务端/客户端从档案拉取后经
 * toPortionOption 映射；LEGACY_PORTION_OPTIONS 仅为历史字符串（存量快照、
 * 迁移前数据）的展示兜底，不参与倍率计算与写入校验。
 */

/** 份量档案行：lib/server 查表与 lib/client hook 拉取后的统一最小形状 */
export type PortionProfileLike = {
  portion: string;
  scenario: string;
  multiplier: number;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
};

/** 份量展示项（前端下拉）：value 为落库标签，description 为计算规则 */
export type PortionOption = {
  value: string;
  label: string;
  description: string;
};

/** 档案行 → 展示项（label 即落库标签） */
export function toPortionOption(profile: PortionProfileLike): PortionOption {
  return {
    value: profile.portion,
    label: profile.portion,
    description: profile.isBase ? "基本单元" : `单人份 × ${profile.multiplier}`,
  };
}

/**
 * 历史份量值兜底（仅展示，不进任何计算与校验）。
 * 社区·N份按新口径描述为 ×N；旧数据倍率语义不做兼容。
 * 导出供客户端在档案接口不可达时降级渲染下拉/标签。
 */
export const LEGACY_PORTION_OPTIONS: Record<string, PortionOption> = {
  单人份: { value: "单人份", label: "单人份", description: "基本单元" },
  小碗菜: { value: "小碗菜", label: "小碗菜", description: "单人份 × 1" },
  一锅10份: { value: "一锅10份", label: "一锅10份", description: "单人份 × 10" },
  "小碗菜·10份": {
    value: "小碗菜·10份",
    label: "小碗菜·10份",
    description: "单人份 × 10",
  },
  "社区·1份": { value: "社区·1份", label: "社区·1份", description: "单人份 × 1" },
  "社区·2份": { value: "社区·2份", label: "社区·2份", description: "单人份 × 2" },
  "社区·3份": { value: "社区·3份", label: "社区·3份", description: "单人份 × 3" },
  "社区·4份": { value: "社区·4份", label: "社区·4份", description: "单人份 × 4" },
};

/**
 * 取份量展示项：传入 profiles 时以档案为准（任意状态——历史快照可能引用
 * 已停用行），未命中或未传档案时走历史兜底。未知值返回 null。
 */
export function getPortionOption(
  portion: string | null | undefined,
  profiles?: PortionProfileLike[] | null
): PortionOption | null {
  if (!portion) return null;
  if (profiles) {
    const row = profiles.find((p) => p.portion === portion);
    if (row) return toPortionOption(row);
  }
  return LEGACY_PORTION_OPTIONS[portion] ?? null;
}

/**
 * 判断当前份量是否是“单人份”基本单元。
 * 客户端只按档案行精确判断；档案未就绪时返回 false，
 * 避免把历史/未知份量误开放为转化源。
 */
export function isBasePortion(
  portion: string | null | undefined,
  profiles: PortionProfileLike[] | null | undefined
): boolean {
  if (!portion || !profiles) return false;
  return profiles.some((row) => row.portion === portion && row.isBase);
}

/**
 * 由源/目标份量档案行推导转化倍率；任一方不在档案或倍率非法时返回 null。
 * profiles 为份量档案行集合（服务端查表、客户端从 hook 缓存取）。
 */
export function portionScaleFactor(
  source: string | null | undefined,
  target: string | null | undefined,
  profiles: PortionProfileLike[]
): number | null {
  const sourceRow = profiles.find((p) => p.portion === source);
  const targetRow = profiles.find((p) => p.portion === target);
  if (!sourceRow || !targetRow || sourceRow.multiplier <= 0) return null;
  return Number((targetRow.multiplier / sourceRow.multiplier).toFixed(4));
}

/**
 * 从历史份量字符串解析等价份数（仅展示用，如历史快照的换算标注）。
 * 优先档案 multiplier，其次历史值兜底（单人份 = 1、一锅10份 = 10），最后按数字解析。
 */
export function parsePortionCount(
  portion: string | null | undefined,
  profiles?: PortionProfileLike[] | null
): number | null {
  if (!portion) return null;
  if (profiles) {
    const row = profiles.find((p) => p.portion === portion);
    if (row) return row.multiplier;
  }
  const legacy = LEGACY_PORTION_OPTIONS[portion];
  if (legacy) {
    if (legacy.description === "基本单元") return 1;
    const match = legacy.description.match(/×\s*(\d+(?:\.\d+)?)/);
    if (match) return Number(match[1]);
  }
  const match = portion.match(/(\d+(?:\.\d+)?)/);
  if (match) return Number(match[1]);
  if (portion.includes("单")) return 1;
  return null;
}
