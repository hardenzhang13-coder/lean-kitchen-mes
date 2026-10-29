import {
  calcJinPerPurchaseUnit,
  calcPricePerJin,
  calculateStockInfo,
  isHighConfidenceSpec,
} from "../spec-parser";
import { buildJinFactors, DEFAULT_JIN_PER_UNIT } from "../unit-conversion";

const UNIT_NAMES = ["斤", "公斤", "千克", "克", "袋", "瓶", "升", "毫升"];

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
