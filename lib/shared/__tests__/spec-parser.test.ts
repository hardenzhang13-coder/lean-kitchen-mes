import {
  calcJinPerPurchaseUnit,
  calcPricePerJin,
  calculateStockInfo,
  isHighConfidenceSpec,
  resolveStockInfo,
  tokenizeSpec,
} from "../spec-parser";
import {
  buildJinFactors,
  buildGramFactors,
  DEFAULT_JIN_PER_UNIT,
} from "../unit-conversion";

const UNIT_NAMES = ["斤", "公斤", "千克", "克", "袋", "瓶", "升", "毫升"];
// 克级换算表（对应单位字典）：斤=500g 公斤=1000g 千克=1000g 克=1g 两=50g
const GRAM_FACTORS = buildGramFactors([
  { name: "斤", gramsPerUnit: 500 },
  { name: "公斤", gramsPerUnit: 1000 },
  { name: "千克", gramsPerUnit: 1000 },
  { name: "克", gramsPerUnit: 1 },
  { name: "两", gramsPerUnit: 50 },
]);

describe("calcJinPerPurchaseUnit", () => {
  it("converts simple weight specs with built-in defaults", () => {
    expect(calcJinPerPurchaseUnit("5斤/袋")).toBe(5);
    expect(calcJinPerPurchaseUnit("1千克*10袋")).toBe(20);
    expect(calcJinPerPurchaseUnit("500克")).toBe(1);
    expect(calcJinPerPurchaseUnit("10两")).toBe(1);
  });

  it("returns null for volume/count-only specs", () => {
    expect(calcJinPerPurchaseUnit("1L*6瓶")).toBeNull();
    expect(calcJinPerPurchaseUnit("10袋")).toBeNull();
  });

  it("returns null for empty or placeholder specs", () => {
    expect(calcJinPerPurchaseUnit("")).toBeNull();
    expect(calcJinPerPurchaseUnit("散称")).toBeNull();
  });

  it("uses injected dictionary factors when provided", () => {
    const factors = buildJinFactors([{ name: "斤", gramsPerUnit: 500 }]);
    expect(calcJinPerPurchaseUnit("5斤/袋", factors)).toBe(5);
    // 自定义「大斤」= 1000g → 2 斤
    const custom = buildJinFactors([
      { name: "斤", gramsPerUnit: 500 },
      { name: "大斤", gramsPerUnit: 1000 },
    ]);
    expect(calcJinPerPurchaseUnit("3大斤", custom)).toBe(6);
    // 字典中不存在的单位不参与重量换算
    expect(calcJinPerPurchaseUnit("1千克*10袋", factors)).toBeNull();
  });
});

describe("buildJinFactors", () => {
  it("converts gramsPerUnit to jin factors", () => {
    expect(
      buildJinFactors([
        { name: "斤", gramsPerUnit: 500 },
        { name: "公斤", gramsPerUnit: 1000 },
        { name: "克", gramsPerUnit: 1 },
      ])
    ).toEqual({ 斤: 1, 公斤: 2, 克: 0.002 });
  });

  it("accepts Prisma Decimal-like values and skips invalid entries", () => {
    expect(
      buildJinFactors([
        { name: "斤", gramsPerUnit: "500" },
        { name: "坏单位", gramsPerUnit: null },
        { name: "零单位", gramsPerUnit: 0 },
        { name: "袋", gramsPerUnit: undefined },
      ])
    ).toEqual({ 斤: 1 });
  });

  it("keeps built-in defaults as fallback", () => {
    expect(DEFAULT_JIN_PER_UNIT["kg"]).toBe(2);
    expect(DEFAULT_JIN_PER_UNIT["斤"]).toBe(1);
  });
});

describe("calcPricePerJin", () => {
  it("computes price per jin from purchase price and spec", () => {
    expect(calcPricePerJin(4.25, "5斤/袋")).toBe(0.85);
    expect(calcPricePerJin(20, "1千克*10袋")).toBe(1);
  });

  it("returns null when price invalid or spec not convertible", () => {
    expect(calcPricePerJin(null, "5斤/袋")).toBeNull();
    expect(calcPricePerJin(-1, "5斤/袋")).toBeNull();
    expect(calcPricePerJin(4.25, "1L*6瓶")).toBeNull();
    expect(calcPricePerJin(4.25, null)).toBeNull();
  });

  it("respects injected dictionary factors", () => {
    const factors = buildJinFactors([{ name: "大斤", gramsPerUnit: 1000 }]);
    expect(calcPricePerJin(12, "2大斤", factors)).toBe(3);
  });

  it("weight-unit purchase converts directly without relying on spec", () => {
    // 散称 + 按斤采购：参照单价即 元/斤
    expect(calcPricePerJin(2.58, "散称", undefined, "斤")).toBe(2.58);
    // 按公斤采购：元/公斤 ÷ 2 = 元/斤
    expect(calcPricePerJin(10, null, undefined, "公斤")).toBe(5);
    // 字典系数优先于内置兜底
    const factors = buildJinFactors([{ name: "斤", gramsPerUnit: 500 }]);
    expect(calcPricePerJin(2.58, "散称", factors, "斤")).toBe(2.58);
    // 非重量采购单位不受影响，仍走规格解析
    expect(calcPricePerJin(4.25, "5斤/袋", undefined, "袋")).toBe(0.85);
    // 无价格仍返回 null
    expect(calcPricePerJin(null, "散称", undefined, "斤")).toBeNull();
  });
});

describe("isHighConfidenceSpec / calculateStockInfo", () => {
  it("requires * separator and a dictionary unit at the end", () => {
    expect(isHighConfidenceSpec("1千克*10袋", UNIT_NAMES)).toBe(true);
    expect(isHighConfidenceSpec("散装", UNIT_NAMES)).toBe(false);
    expect(isHighConfidenceSpec("5斤", UNIT_NAMES)).toBe(false);
    expect(isHighConfidenceSpec("1千克*10筐", UNIT_NAMES)).toBe(false);
  });

  it("computes stock-in qty from spec and qty", () => {
    expect(calculateStockInfo({ spec: "1千克*10袋", qty: 3, unitNames: UNIT_NAMES })).toEqual({
      stockUnit: "袋",
      stockInQty: 30,
    });
  });

  it("honors target stock unit", () => {
    expect(
      calculateStockInfo({
        spec: "1千克*10袋",
        qty: 3,
        targetStockUnit: "千克",
        unitNames: UNIT_NAMES,
      })
    ).toEqual({ stockUnit: "千克", stockInQty: 3 });
  });

  it("falls back to qty 1 when spec not parseable", () => {
    expect(calculateStockInfo({ spec: "散装", qty: 3, unitNames: UNIT_NAMES })).toEqual({
      stockInQty: 1,
    });
  });
});

describe("tokenizeSpec", () => {
  it("extracts number+unit tokens across separators", () => {
    expect(tokenizeSpec("5斤")).toEqual([{ value: 5, unit: "斤" }]);
    expect(tokenizeSpec("5斤/袋")).toEqual([{ value: 5, unit: "斤" }]);
    expect(tokenizeSpec("1千克*10袋")).toEqual([
      { value: 1, unit: "千克" },
      { value: 10, unit: "袋" },
    ]);
    expect(tokenizeSpec("2袋*5斤")).toEqual([
      { value: 2, unit: "袋" },
      { value: 5, unit: "斤" },
    ]);
  });

  it("returns empty for placeholders and unit-only fragments", () => {
    expect(tokenizeSpec("")).toEqual([]);
    expect(tokenizeSpec("散称")).toEqual([]);
    expect(tokenizeSpec("散装称斤")).toEqual([]);
    expect(tokenizeSpec("袋")).toEqual([]);
  });
});

describe("resolveStockInfo", () => {
  it("weight target: converts via gram factors", () => {
    expect(
      resolveStockInfo({ spec: "5斤", qty: 3, targetStockUnit: "斤", gramFactors: GRAM_FACTORS })
    ).toEqual({ stockUnit: "斤", stockInQty: 15, confidence: "high" });
    // 5斤/袋：采购单位=袋，入库单位=斤 → 每袋 5 斤
    expect(
      resolveStockInfo({ spec: "5斤/袋", qty: 3, targetStockUnit: "斤", gramFactors: GRAM_FACTORS })
    ).toEqual({ stockUnit: "斤", stockInQty: 15, confidence: "high" });
    // 1千克*10袋 入库斤 → 20 斤/采购单位
    expect(
      resolveStockInfo({
        spec: "1千克*10袋",
        qty: 2,
        targetStockUnit: "斤",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "斤", stockInQty: 40, confidence: "high" });
    // 2袋*5斤 入库斤 → 10 斤/采购单位
    expect(
      resolveStockInfo({
        spec: "2袋*5斤",
        qty: 2,
        targetStockUnit: "斤",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "斤", stockInQty: 20, confidence: "high" });
  });

  it("weight purchase: converts qty between weight units", () => {
    // 按公斤采购、入库单位=斤 → 1:2
    expect(
      resolveStockInfo({
        spec: "散装称斤",
        qty: 3,
        purchaseUnit: "公斤",
        targetStockUnit: "斤",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "斤", stockInQty: 6, confidence: "high" });
    // 按斤采购、入库单位=斤 → 1:1
    expect(
      resolveStockInfo({
        spec: "散装称斤",
        qty: 3,
        purchaseUnit: "斤",
        targetStockUnit: "斤",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "斤", stockInQty: 3, confidence: "high" });
  });

  it("count target: matches unit tokens", () => {
    expect(
      resolveStockInfo({
        spec: "1千克*10袋",
        qty: 2,
        targetStockUnit: "袋",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "袋", stockInQty: 20, confidence: "high" });
  });

  it("implicit 1:1 requires purchaseUnit === target (spec is weight info only)", () => {
    // 采购单位=袋、入库单位=袋：规格 5斤/袋 只是重量说明 → 1:1 high
    expect(
      resolveStockInfo({
        spec: "5斤/袋",
        qty: 3,
        purchaseUnit: "袋",
        targetStockUnit: "袋",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "袋", stockInQty: 3, confidence: "high" });
    // 猪血场景：采购单位=盒、入库单位=盒、规格 3斤/盒 → 1:1 high
    expect(
      resolveStockInfo({
        spec: "3斤/盒",
        qty: 5,
        purchaseUnit: "盒",
        targetStockUnit: "盒",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "盒", stockInQty: 5, confidence: "high" });
    // 按箱采购、规格只说每盒 3 斤 → 箱→盒数量未知，按 1:1 估算但 low
    expect(
      resolveStockInfo({
        spec: "3斤/盒",
        qty: 5,
        purchaseUnit: "箱",
        targetStockUnit: "盒",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "盒", stockInQty: 5, confidence: "low" });
    // 5斤/袋 入库盒（跨单位无 token 匹配）→ low
    expect(
      resolveStockInfo({
        spec: "5斤/袋",
        qty: 3,
        purchaseUnit: "袋",
        targetStockUnit: "盒",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "盒", stockInQty: 3, confidence: "low" });
  });

  it("marks low confidence when spec cannot justify the conversion", () => {
    // 10袋 入库斤：无重量信息
    expect(
      resolveStockInfo({ spec: "10袋", qty: 3, purchaseUnit: "袋", targetStockUnit: "斤", gramFactors: GRAM_FACTORS })
    ).toEqual({ stockUnit: "斤", stockInQty: 3, confidence: "low" });
    // 占位符
    expect(
      resolveStockInfo({
        spec: "散装称斤",
        qty: 3,
        purchaseUnit: "袋",
        targetStockUnit: "斤",
        gramFactors: GRAM_FACTORS,
      })
    ).toEqual({ stockUnit: "斤", stockInQty: 1, confidence: "low" });
  });

  it("falls back to last-token semantics when no target", () => {
    expect(resolveStockInfo({ spec: "5斤/袋", qty: 3, gramFactors: GRAM_FACTORS })).toEqual({
      stockUnit: "斤",
      stockInQty: 15,
      confidence: "high",
    });
    expect(resolveStockInfo({ spec: "1千克*10袋", qty: 3, gramFactors: GRAM_FACTORS })).toEqual({
      stockUnit: "袋",
      stockInQty: 30,
      confidence: "high",
    });
  });
});
