import {
  resolveNetBomAmountG,
  resolvePackageSpecAmountG,
} from "../bom-amount";

describe("resolvePackageSpecAmountG", () => {
  it("有标准规格时强制等于标准规格", () => {
    expect(resolvePackageSpecAmountG(100, 1200)).toBe(1200);
    expect(resolvePackageSpecAmountG(999, "500")).toBe(500);
  });

  it("标准规格缺失时回退存储用量", () => {
    expect(resolvePackageSpecAmountG(100, null)).toBe(100);
    expect(resolvePackageSpecAmountG(100, undefined)).toBe(100);
    expect(resolvePackageSpecAmountG(100, 0)).toBe(100);
  });

  it("两者都非法时返回 0", () => {
    expect(resolvePackageSpecAmountG(null, null)).toBe(0);
    expect(resolvePackageSpecAmountG("abc", "abc")).toBe(0);
  });

  it("与旧口径 resolveNetBomAmountG 行为一致", () => {
    const cases: Array<[unknown, unknown]> = [
      [100, 1200],
      [100, null],
      [null, null],
      [0, 500],
      ["abc", 500],
    ];
    cases.forEach(([amountG, packageSpec]) => {
      expect(resolveNetBomAmountG(amountG, packageSpec)).toBe(
        resolvePackageSpecAmountG(amountG, packageSpec)
      );
    });
  });
});
