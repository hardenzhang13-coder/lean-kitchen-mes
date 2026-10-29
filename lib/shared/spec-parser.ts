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
 * 可换算为"斤"的单位及其系数（含中英文缩写）。
 * 仅这些单位可用于采购规格 → 斤的自动换算；袋/瓶/箱/升等计数或体积单位不参与换算但不阻断。
 */
const JIN_PER_UNIT: Record<string, number> = {
  斤: 1,
  两: 0.1,
  克: 0.002,
  g: 0.002,
  千克: 2,
  kg: 2,
  公斤: 2,
};

/**
 * 计算一个采购单位包含多少斤。
 * 按 * / 空格 拆分规格，每个片段提取「数字 + 单位」：
 * - 重量单位（斤/两/克/千克/公斤 及缩写）累乘 数字×系数
 * - 计数单位（袋/瓶/箱等）和体积单位（升/毫升等）只乘数量、不提供重量系数
 * - 无数字的纯单位片段（如"袋"）跳过
 * 若整个规格不含任何重量单位，返回 null（无法换算，由用户手动填写）。
 *
 * 例：5斤/袋 -> 5；1千克*10袋 -> 2*10 = 20；1L*6瓶 -> null
 */
export function calcJinPerPurchaseUnit(spec: string): number | null {
  const s = (spec || "").trim();
  if (!s || PLACEHOLDER_RE.test(s)) return null;

  const parts = s.split(/[*/\s]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  let jin = 1;
  let hasWeight = false;
  for (const part of parts) {
    const m = part.match(/^(\d+\.?\d*)\s*([^\d\s]*)$/);
    if (!m) continue; // 无数字的片段（如"袋"）跳过
    const value = Number(m[1]);
    const unit = m[2];
    const factor = JIN_PER_UNIT[unit];
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
 * 例：4.25 元/袋，规格 5斤/袋 -> 0.85 元/斤
 */
export function calcPricePerJin(
  refPrice: number | string | unknown,
  spec: string | null | undefined
): number | null {
  const price = toNumber(refPrice);
  if (price == null || price <= 0) return null;

  const jin = calcJinPerPurchaseUnit(spec || "");
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
