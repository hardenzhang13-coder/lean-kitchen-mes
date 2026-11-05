import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "../net-price";

describe("calcCostPricePerJin", () => {
  it("adds processing fee to unit price", () => {
    expect(calcCostPricePerJin(5, 0.5)).toBe(5.5);
    expect(calcCostPricePerJin(5, 0)).toBe(5);
    // 加工费空 = 0
    expect(calcCostPricePerJin(5, null)).toBe(5);
    expect(calcCostPricePerJin(5, undefined)).toBe(5);
  });

  it("accepts Prisma Decimal-like values", () => {
    expect(calcCostPricePerJin("3.7", "0.3")).toBe(4);
  });

  it("rounds to 2 decimals", () => {
    expect(calcCostPricePerJin(3.333, 0.111)).toBe(3.44);
  });

  it("returns null for invalid unit price or negative fee", () => {
    expect(calcCostPricePerJin(null, 0.5)).toBeNull();
    expect(calcCostPricePerJin(-1, 0.5)).toBeNull();
    expect(calcCostPricePerJin(5, -0.5)).toBeNull();
  });
});

describe("calcOutPricePerJin（真毛利率口径）", () => {
  it("空毛利率 = 0 时出库价 = 成本价", () => {
    expect(calcOutPricePerJin(5, null)).toBe(5);
    expect(calcOutPricePerJin(5, undefined)).toBe(5);
    expect(calcOutPricePerJin(5, 0)).toBe(5);
  });

  it("按真毛利率公式计算：成本价 ÷ (1 - 毛利率/100)", () => {
    // PRD-0011 实测口径：成本 4.03，毛利 40% → 6.72
    expect(calcOutPricePerJin(4.03, 40)).toBe(6.72);
    // 50% 毛利 → 成本翻倍
    expect(calcOutPricePerJin(5, 50)).toBe(10);
    // 毛利 25% → 成本 ÷ 0.75
    expect(calcOutPricePerJin(7.5, 25)).toBe(10);
  });

  it("毛利率恰好等于公式口径（验证非成本加成）", () => {
    const cost = 4.03;
    const out = calcOutPricePerJin(cost, 40);
    // (出库价 - 成本价) / 出库价 ≈ 40%
    expect(out).not.toBeNull();
    expect(Number((((out as number) - cost) / (out as number)).toFixed(2))).toBe(0.4);
  });

  it("rounds to 2 decimals", () => {
    expect(calcOutPricePerJin(3.333, 30)).toBe(4.76);
  });

  it("accepts Prisma Decimal-like values", () => {
    expect(calcOutPricePerJin("4.03", "40")).toBe(6.72);
  });

  it("returns null for invalid cost or margin out of [0, 100)", () => {
    expect(calcOutPricePerJin(null, 40)).toBeNull();
    expect(calcOutPricePerJin(-1, 40)).toBeNull();
    expect(calcOutPricePerJin(5, -1)).toBeNull();
    // 毛利率 ≥ 100 无意义（除零/负售价）
    expect(calcOutPricePerJin(5, 100)).toBeNull();
  });
});

describe("calcStandardPackagePrice", () => {
  it("computes per-package price from out price and package spec", () => {
    // 500g = 1 斤 → 等于出库价
    expect(calcStandardPackagePrice(5.5, 500)).toBe(5.5);
    // 250g = 半斤
    expect(calcStandardPackagePrice(5.5, 250)).toBe(2.75);
    // 1kg = 2 斤
    expect(calcStandardPackagePrice(4, 1000)).toBe(8);
    // PRD-0011：出库价 6.72 × 1000g ÷ 500 = 13.44
    expect(calcStandardPackagePrice(6.72, 1000)).toBe(13.44);
  });

  it("rounds to 2 decimals", () => {
    expect(calcStandardPackagePrice(3.33, 300)).toBe(2);
  });

  it("returns null when out price or package spec missing/invalid", () => {
    expect(calcStandardPackagePrice(null, 500)).toBeNull();
    expect(calcStandardPackagePrice(5.5, null)).toBeNull();
    expect(calcStandardPackagePrice(5.5, 0)).toBeNull();
    expect(calcStandardPackagePrice(5.5, -100)).toBeNull();
  });
});
