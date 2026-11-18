import { resolveNetBomAmountG } from "../bom-amount";

describe("resolveNetBomAmountG", () => {
  it("优先使用封装规格", () => {
    expect(resolveNetBomAmountG(900, 800)).toBe(800);
    expect(resolveNetBomAmountG("600", 800)).toBe(800);
  });

  it("封装规格缺失或非法时回退历史用量", () => {
    expect(resolveNetBomAmountG(900, null)).toBe(900);
    expect(resolveNetBomAmountG(900, 0)).toBe(900);
    expect(resolveNetBomAmountG(900, -1)).toBe(900);
    expect(resolveNetBomAmountG("900", undefined)).toBe(900);
  });

  it("两者都缺失时返回 0", () => {
    expect(resolveNetBomAmountG(null, null)).toBe(0);
    expect(resolveNetBomAmountG(undefined, 0)).toBe(0);
  });
});
