import { deriveSeasoningProductPrices } from "../seasoning-spec";

describe("标准化调料价格链路（与净料同构）", () => {
  const base = {
    yieldRate: 100,
    processingFeePerJin: null,
    grossMarginRate: null,
    packageSpec: 1200,
    sourceIngredient: { pricePerJin: 10 },
  };

  it("出成率 100 时单价 = 来源调料每斤单价", () => {
    const prices = deriveSeasoningProductPrices(base);
    expect(prices.unitPrice).toBe(10);
    expect(prices.costPricePerJin).toBe(10);
    expect(prices.outPricePerJin).toBe(10);
    expect(prices.grossMarginRate).toBe(0);
  });

  it("出成率 80 时单价 = 每斤单价 ÷ 0.8", () => {
    const prices = deriveSeasoningProductPrices({ ...base, yieldRate: 80 });
    expect(prices.unitPrice).toBe(12.5);
    expect(prices.outPricePerJin).toBe(12.5);
  });

  it("封装加工费计入成本价，毛利率按真口径算", () => {
    const prices = deriveSeasoningProductPrices({
      ...base,
      processingFeePerJin: 2,
      grossMarginRate: 20,
    });
    expect(prices.costPricePerJin).toBe(12);
    expect(prices.outPricePerJin).toBe(15);
  });

  it("标准规格价 = 出库价 × 标准规格 ÷ 500", () => {
    const prices = deriveSeasoningProductPrices(base);
    // 10 × 1200 ÷ 500 = 24
    expect(prices.standardPackagePrice).toBe(24);
  });

  it("来源调料缺每斤单价或出成率非法时单价为 null", () => {
    expect(
      deriveSeasoningProductPrices({
        ...base,
        sourceIngredient: { pricePerJin: null },
      }).unitPrice
    ).toBeNull();
    expect(
      deriveSeasoningProductPrices({ ...base, yieldRate: 0 }).unitPrice
    ).toBeNull();
    expect(
      deriveSeasoningProductPrices({ ...base, yieldRate: null }).unitPrice
    ).toBeNull();
  });

  it("毛利率非法（≥100）时出库价为 null", () => {
    const prices = deriveSeasoningProductPrices({
      ...base,
      grossMarginRate: 100,
    });
    expect(prices.outPricePerJin).toBeNull();
    expect(prices.standardPackagePrice).toBeNull();
  });

  it("标准规格非法时标准规格价为 null", () => {
    const prices = deriveSeasoningProductPrices({ ...base, packageSpec: 0 });
    expect(prices.standardPackagePrice).toBeNull();
  });

  it("外购口径：单价直接取手填每斤单价，忽略来源与出成率", () => {
    const prices = deriveSeasoningProductPrices({
      sourceMode: "purchase",
      pricePerJin: 8,
      yieldRate: null,
      sourceIngredient: null,
      packageSpec: 500,
    });
    expect(prices.unitPrice).toBe(8);
    expect(prices.outPricePerJin).toBe(8);
    expect(prices.standardPackagePrice).toBe(8); // 8 × 500 ÷ 500
  });

  it("外购口径：手填每斤单价缺失或非正时单价为 null", () => {
    expect(
      deriveSeasoningProductPrices({ sourceMode: "purchase", pricePerJin: null }).unitPrice
    ).toBeNull();
    expect(
      deriveSeasoningProductPrices({ sourceMode: "purchase", pricePerJin: 0 }).unitPrice
    ).toBeNull();
  });
});
