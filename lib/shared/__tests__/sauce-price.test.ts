import {
  applyProcessingFee,
  calcRecipeLineCost,
  calcSauceCostPricePerJin,
} from "../sauce-price";

describe("calcRecipeLineCost", () => {
  it("行成本（元）= 行单价（元/斤）× 用量g ÷ 500", () => {
    // 出库价 6.72 元/斤，用 125g → 1.68
    expect(calcRecipeLineCost(6.72, 125)).toBe(1.68);
    // 1 斤 = 500g → 等于行单价
    expect(calcRecipeLineCost(10, 500)).toBe(10);
    // 半斤
    expect(calcRecipeLineCost(10, 250)).toBe(5);
  });

  it("rounds to 2 decimals", () => {
    expect(calcRecipeLineCost(3.333, 300)).toBe(2);
  });

  it("returns null for invalid price or amount", () => {
    expect(calcRecipeLineCost(null, 100)).toBeNull();
    expect(calcRecipeLineCost(5, null)).toBeNull();
    expect(calcRecipeLineCost(5, 0)).toBeNull();
    expect(calcRecipeLineCost(-1, 100)).toBeNull();
  });
});

describe("calcSauceCostPricePerJin", () => {
  it("成本价（元/斤）= 行成本合计 ÷ 总克重 × 500", () => {
    // 模拟宫保汁简化配方：两行各 500g、各 5 元 → 成本 5 元/斤
    expect(
      calcSauceCostPricePerJin([
        { cost: 5, amountG: 500 },
        { cost: 5, amountG: 500 },
      ])
    ).toBe(5);
    // 投入 2500g、合计成本 30 元 → 30/2500*500 = 6 元/斤
    expect(
      calcSauceCostPricePerJin([
        { cost: 20, amountG: 2000 },
        { cost: 10, amountG: 500 },
      ])
    ).toBe(6);
  });

  it("rounds to 2 decimals", () => {
    expect(
      calcSauceCostPricePerJin([
        { cost: 1, amountG: 300 },
        { cost: 1, amountG: 300 },
      ])
    ).toBe(1.67);
  });

  it("returns null when empty or any line missing cost", () => {
    expect(calcSauceCostPricePerJin([])).toBeNull();
    expect(
      calcSauceCostPricePerJin([
        { cost: 5, amountG: 500 },
        { cost: null, amountG: 500 },
      ])
    ).toBeNull();
    expect(calcSauceCostPricePerJin([{ cost: 5, amountG: 0 }])).toBeNull();
  });
});

describe("applyProcessingFee", () => {
  it("成本价叠加加工费（元/斤），与净料同语义", () => {
    expect(applyProcessingFee(7.9, 0.5)).toBe(8.4);
    expect(applyProcessingFee(7.9, null)).toBe(7.9);
    expect(applyProcessingFee(7.9, undefined)).toBe(7.9);
    expect(applyProcessingFee(7.9, 0)).toBe(7.9);
  });

  it("rounds to 2 decimals", () => {
    expect(applyProcessingFee(3.333, 0.111)).toBe(3.44);
  });

  it("returns null for invalid cost or negative fee", () => {
    expect(applyProcessingFee(null, 0.5)).toBeNull();
    expect(applyProcessingFee(-1, 0.5)).toBeNull();
    expect(applyProcessingFee(5, -0.5)).toBeNull();
  });
});
