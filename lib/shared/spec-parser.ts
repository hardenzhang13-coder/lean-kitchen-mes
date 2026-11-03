import { DEFAULT_JIN_PER_UNIT } from "./unit-conversion";

export interface ParsedSpec {
  /** 规格中解析出的“每采购单位包含多少库存单位” */
  multiplier: number;
  /** 解析出的库存单位 */
  stockUnit: string;
  /** 规格中所有 number+unit 片段 */
  tokens: Array<{ value: number; unit: string }>;
}

const PLACEHOLDER_RE = /^(散称|散装|无|—|-)$/;
const TRAILING_TOKEN_RE = /(\d+\.?\d*)\s*([^\d\s]+)$/;

/**
 * 判断规格是否具备高置信度，可以进行采购单位→入库数量的自动换算。
 *
 * 规则：
 * 1. 空值或占位符（散称/散装/无/—/-）返回 false。
 * 2. 规格中必须包含 * 分隔符。
 * 3. 规格结尾必须符合「数字+单位」结构；若提供 unitNames，则该单位必须在单位字典中。
 * 4. 其余情况返回 false，避免误换算。
 */
export function isHighConfidenceSpec(
  spec: string,
  unitNames: string[] = []
): boolean {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return false;
  if (!s.includes("*")) return false;
  const m = s.match(TRAILING_TOKEN_RE);
  if (!m) return false;
  const unit = m[2];
  return unitNames.length === 0 || unitNames.includes(unit);
}

/**
 * 从采购规格中解析数量-单位片段。
 * 仅对 isHighConfidenceSpec 返回 true 的规格进行解析，否则返回 null。
 *
 * 支持：1千克*10袋、1.9L*6瓶
 */
export function parsePurchaseSpec(
  spec: string,
  unitNames: string[] = []
): ParsedSpec | null {
  const s = (spec || "").trim();
  if (!isHighConfidenceSpec(s, unitNames)) return null;

  const tokens: Array<{ value: number; unit: string }> = [];
  const parts = s.split("*").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^(\d+\.?\d*)\s*([^\d\s]+)$/);
    if (m) {
      tokens.push({ value: Number(m[1]), unit: m[2] });
    }
  }

  if (tokens.length === 0) return null;

  const last = tokens[tokens.length - 1];
  return {
    multiplier: last.value,
    stockUnit: last.unit,
    tokens,
  };
}

export interface CalculateStockInfoInput {
  spec: string;
  qty: number;
  /** 用户手动指定的入库单位；未指定时使用规格解析结果 */
  targetStockUnit?: string;
  /** 单位字典名称列表，用于严格校验规格末尾单位 */
  unitNames?: string[];
}

export interface CalculateStockInfoResult {
  stockUnit?: string;
  stockInQty?: number;
}

/**
 * 根据采购规格、数量、采购单位计算入库单位与入库数量。
 * 如果规格置信度不足或无法解析，默认入库数量为 1。
 */
export function calculateStockInfo({
  spec,
  qty,
  targetStockUnit,
  unitNames,
}: CalculateStockInfoInput): CalculateStockInfoResult {
  const parsed = parsePurchaseSpec(spec, unitNames);
  if (!parsed || !qty) {
    return { stockInQty: 1 };
  }

  if (targetStockUnit) {
    const token = parsed.tokens.find(
      (t) => t.unit === targetStockUnit || t.unit.includes(targetStockUnit)
    );
    if (token) {
      return {
        stockUnit: token.unit,
        stockInQty: round2(qty * token.value),
      };
    }
  }

  return {
    stockUnit: parsed.stockUnit,
    stockInQty: round2(qty * parsed.multiplier),
  };
}

/**
 * 当采购规格为空时，按入库单位给出默认规格文案。
 */
export function getDefaultSpec(stockUnit: string): string {
  if (!stockUnit) return "单件";
  if (stockUnit === "斤") return "散装称斤";
  return `单${stockUnit}`;
}

// ---------------------------------------------------------------------------
// 统一规格解析（宽语法）
// ---------------------------------------------------------------------------

export interface SpecToken {
  value: number;
  unit: string;
}

const SPEC_SPLIT_RE = /[*×/\s]+/;
const TOKEN_RE = /^(\d+\.?\d*)\s*([^\d\s]+)$/;

/**
 * 宽语法 token 化：按 * × / 空格 拆分规格，提取所有「数字+单位」片段。
 * 与 calcJinPerPurchaseUnit 的语法一致，支持 5斤、5斤/袋、1千克*10袋、2袋*5斤。
 * 纯单位片段（如「袋」）与占位符（散装称斤/单袋）不产出 token。
 */
export function tokenizeSpec(spec: string): SpecToken[] {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return [];
  const tokens: SpecToken[] = [];
  for (const part of s.split(SPEC_SPLIT_RE).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(TOKEN_RE);
    if (m) tokens.push({ value: Number(m[1]), unit: m[2] });
  }
  return tokens;
}

export interface ResolveStockInfoInput {
  spec: string;
  qty: number;
  /** 采购单位；重量单位（在 gramFactors 中）时走「按重直采」换算 */
  purchaseUnit?: string;
  /** 期望的入库单位；缺省时沿用「末 token」语义 */
  targetStockUnit?: string;
  /** 「单位名 → 1 单位合多少克」，由调用方从单位字典构建（buildGramFactors） */
  gramFactors?: Record<string, number>;
}

export interface ResolveStockInfoResult {
  stockUnit: string | null;
  stockInQty: number;
  /** high = 换算有依据；low = 占位符/无法换算按 1 兜底，前端应提示用户核对 */
  confidence: "high" | "low";
}

/**
 * 统一入库换算（宽语法版 calculateStockInfo）。
 *
 * 语义：采购规格是「换算描述符」——1 个采购单位 = N 个库存单位；
 * 库存按食材各自的入库单位记账，不做全局统一。
 *
 * 注意：purchaseSpec 业务上必填（表单校验 + ensureDefaultSpec 兜底），
 * 传入的 spec 始终非空；但占位符（散称/散装称斤/单袋等）不含可换算的
 * 数字 token，此时 stockInQty=1 且 confidence=low，由前端提示用户核对。
 *
 * 策略（按优先级）：
 * 1. 按重直采（purchaseUnit 是重量单位）：
 *    - target 同为重量单位 → stockInQty = qty × 克(采购) ÷ 克(入库)，high
 *    - target 缺失 → 按采购单位 1:1 入库，high
 *    - target 是计数单位 → 落到规格 token 逻辑
 * 2. target 是重量单位：每采购单位克数 = Π(重量 token: value×克数) × Π(计数 token: value)，
 *    stockInQty = qty × 克数 ÷ 克(target)；无重量 token → 落到计数 token 逻辑
 * 3. target 是计数单位：取 unit===target 的 token 值（多个则乘积）；
 *    无匹配时仅当「采购单位 = 入库单位」且规格含重量信息才隐含 1:1 判 high
 *    （规格只是重量说明）；跨单位无依据 → 按 1:1 估算但 confidence=low
 * 4. 无 target：末 token 语义（宽语法，兼容存量行为）
 * 5. 无可解析 token（占位符/纯文本）→ stockInQty=1, low
 */
export function resolveStockInfo({
  spec,
  qty,
  purchaseUnit,
  targetStockUnit,
  gramFactors,
}: ResolveStockInfoInput): ResolveStockInfoResult {
  // 字典未注入时以内置兜底值推导克级系数，保证换算仍可用
  const table: Record<string, number> =
    gramFactors ??
    Object.fromEntries(
      Object.entries(DEFAULT_JIN_PER_UNIT).map(([k, v]) => [k, v * 500])
    );
  const tokens = tokenizeSpec(spec);
  const safeQty = Number(qty) || 0;
  const lowFallback: ResolveStockInfoResult = {
    stockUnit: targetStockUnit ?? null,
    stockInQty: 1,
    confidence: "low",
  };
  if (
    tokens.length === 0 &&
    !(purchaseUnit && table[purchaseUnit] != null && targetStockUnit && table[targetStockUnit] != null)
  ) {
    return lowFallback;
  }

  // 1. 按重直采
  if (purchaseUnit && table[purchaseUnit] != null) {
    if (!targetStockUnit) {
      return { stockUnit: purchaseUnit, stockInQty: round2(safeQty), confidence: "high" };
    }
    if (table[targetStockUnit] != null) {
      return {
        stockUnit: targetStockUnit,
        stockInQty: round2((safeQty * table[purchaseUnit]) / table[targetStockUnit]),
        confidence: "high",
      };
    }
    // target 是计数单位 → 落到规格 token 逻辑
  }

  if (tokens.length === 0) return lowFallback;

  // 2. target 是重量单位：全 token 乘积换算克数后转目标
  if (targetStockUnit && table[targetStockUnit] != null) {
    let grams = 1;
    let hasWeight = false;
    for (const t of tokens) {
      const g = table[t.unit];
      if (g != null) {
        grams *= t.value * g;
        hasWeight = true;
      } else {
        grams *= t.value;
      }
    }
    if (hasWeight) {
      return {
        stockUnit: targetStockUnit,
        stockInQty: round2((safeQty * grams) / table[targetStockUnit]),
        confidence: "high",
      };
    }
    // target 是重量但规格无重量信息 → 落到计数 token 逻辑
  }

  // 3. target 是计数单位：精确匹配 token
  if (targetStockUnit) {
    const matched = tokens.filter((t) => t.unit === targetStockUnit);
    if (matched.length > 0) {
      const multiplier = matched.reduce((acc, t) => acc * t.value, 1);
      return { stockUnit: targetStockUnit, stockInQty: round2(safeQty * multiplier), confidence: "high" };
    }
    // 隐含 1:1 需要双重依据：
    // - 采购单位 = 入库单位（买卖同单位，规格只是重量说明，如「3斤/盒」每采购单位即 1 盒）
    // - 且规格含重量 token 或尾段裸单位与 target 相同（如「5斤/袋」尾段「袋」）
    // 采购单位与入库单位不同则无依据（如按箱采购、规格只说每盒 3 斤），不能臆断 1:1
    const hasWeightToken = tokens.some((t) => table[t.unit] != null);
    const trailing = (spec.trim().split(SPEC_SPLIT_RE).filter(Boolean).pop() || "").trim();
    const trailingBareUnit = trailing !== "" && !/^\d/.test(trailing) ? trailing : null;
    const sameUnit = purchaseUnit === targetStockUnit;
    if (sameUnit && (hasWeightToken || trailingBareUnit === targetStockUnit)) {
      return { stockUnit: targetStockUnit, stockInQty: round2(safeQty), confidence: "high" };
    }
    // 跨单位且规格未给出换算关系 → 按 1:1 估算但标记 low，由前端提示人工核对
    return { stockUnit: targetStockUnit, stockInQty: round2(safeQty), confidence: "low" };
  }

  // 4. 无 target：末 token 语义（宽语法）
  const last = tokens[tokens.length - 1];
  return { stockUnit: last.unit, stockInQty: round2(safeQty * last.value), confidence: "high" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 将 Prisma Decimal / number / string 统一转换为 number，null/undefined 返回 null。
 */
function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v as number | string);
  return Number.isNaN(n) ? null : n;
}

/**
 * 计算一个采购单位包含多少斤。
 * 按 * / 空格 拆分规格，每个片段提取「数字 + 单位」：
 * - 重量单位（斤/两/克/千克/公斤 及缩写）累乘 数字×系数
 * - 计数单位（袋/瓶/箱等）和体积单位（升/毫升等）只乘数量、不提供重量系数
 * - 无数字的纯单位片段（如"袋"）跳过
 * 若整个规格不含任何重量单位，返回 null（无法换算，由用户手动填写）。
 *
 * factors 为「单位名 → 每斤系数」换算表，由调用方从单位字典构建
 * （lib/shared/unit-conversion.ts 的 buildJinFactors）；缺省时使用内置兜底值。
 *
 * 例：5斤/袋 -> 5；1千克*10袋 -> 2*10 = 20；1L*6瓶 -> null
 */
export function calcJinPerPurchaseUnit(
  spec: string,
  factors?: Record<string, number>
): number | null {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return null;

  const table = factors ?? DEFAULT_JIN_PER_UNIT;
  const parts = s.split(/[*/\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let jin = 1;
  let hasWeight = false;
  for (const part of parts) {
    const m = part.match(/^(\d+\.?\d*)\s*([^\d\s]*)$/);
    if (!m) continue; // 无数字的片段（如"袋"）跳过
    const value = Number(m[1]);
    const unit = m[2];
    const factor = table[unit];
    if (factor != null) {
      jin *= value * factor;
      hasWeight = true;
    } else {
      // 非重量单位（袋/瓶/箱/升等），只乘数量不提供重量
      jin *= value;
    }
  }

  if (!hasWeight) return null;
  return jin > 0 ? jin : null;
}

/**
 * 根据最新参照单价和采购规格计算每斤单价。
 * 规格无法换算为斤时返回 null（由用户手动填写）。
 *
 * 按重直采：采购单位本身是重量单位时，参照单价就是「元/采购重量单位」，
 * 直接按字典系数换算（如 元/公斤 ÷ 2 = 元/斤），不依赖规格文本。
 * 该规则优先于规格解析，因为采购单位才是定价单位。
 *
 * 例：4.25 元/袋，规格 5斤/袋 -> 0.85 元/斤；2.58 元/斤（散称）-> 2.58 元/斤
 */
export function calcPricePerJin(
  refPrice: number | string | unknown,
  spec: string | null | undefined,
  factors?: Record<string, number>,
  purchaseUnit?: string | null
): number | null {
  const price = toNumber(refPrice);
  if (price == null || price <= 0) return null;

  // 按重直采：采购单位是重量单位（在换算表中）→ 直接换算
  const table = factors ?? DEFAULT_JIN_PER_UNIT;
  if (purchaseUnit && table[purchaseUnit] != null) {
    return Math.round((price / table[purchaseUnit]) * 10000) / 10000;
  }

  const jin = calcJinPerPurchaseUnit(spec || "", factors);
  if (jin == null) return null;

  return Math.round((price / jin) * 10000) / 10000;
}

/**
 * 计算净料单价（单位：500g = 1 斤）。
 * 严格基于每斤单价计算：净料单价 = 每斤单价 ÷ (出成率 / 100)。
 * 出成率为百分比（80 表示 80%），除以 100 转成实际比例。
 * 每斤单价缺失或无效时返回 null——不允许回退到最新参照单价（那是"元/采购单位"，
 * 不是"元/斤"，混用会导致数量级错误），此时应由用户手动填写净料单价。
 */
export function calcNetUnitPrice(input: {
  pricePerJin?: number | string | unknown;
  yieldRate: number;
}): number | null {
  const { yieldRate } = input;
  if (!yieldRate || yieldRate <= 0) return null;

  const jin = toNumber(input.pricePerJin);
  if (jin == null || jin <= 0) return null;

  return Number((jin / (yieldRate / 100)).toFixed(2));
}
