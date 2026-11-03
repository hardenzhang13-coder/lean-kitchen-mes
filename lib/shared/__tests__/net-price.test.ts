import {
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "../net-price";

describe("calcOutPricePerJin", () => {
  it("adds processing fee to cost price", () => {
    expect(calcOutPricePerJin(5, 0.5)).toBe(5.5);
    expect(calcOutPricePerJin(5, 0)).toBe(5);
    // 加工费空 = 0
    expect(calcOutPricePerJin(5, null)).toBe(5);
    expect(calcOutPricePerJin(5, undefined)).toBe(5);
  });

  it("accepts Prisma Decimal-like values", () => {
    expect(calcOutPricePerJin("3.7", "0.3")).toBe(4);
  });

  it("rounds to 2 decimals", () => {
    expect(calcOutPricePerJin(3.333, 0.111)).toBe(3.44);
  });

  it("returns null for invalid cost or negative fee", () => {
    expect(calcOutPricePerJin(null, 0.5)).toBeNull();
    expect(calcOutPricePerJin(-1, 0.5)).toBeNull();
    expect(calcOutPricePerJin(5, -0.5)).toBeNull();
  });
});

describe("calcStandardPackagePrice", () => {
  it("computes per-package price from out price and package spec", () => {
    // 500g = 1 斤 → 等于成本价
    expect(calcStandardPackagePrice(5.5, 500)).toBe(5.5);
    // 250g = 半斤
    expect(calcStandardPackagePrice(5.5, 250)).toBe(2.75);
    // 1kg = 2 斤
    expect(calcStandardPackagePrice(4, 1000)).toBe(8);
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
