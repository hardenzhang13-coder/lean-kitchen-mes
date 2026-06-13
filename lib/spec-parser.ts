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
