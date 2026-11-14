import {
  deriveNetIngredientPrices,
  serializeNetIngredient,
} from "../net-ingredient-utils";

describe("净料实时派生价格", () => {
  it("按来源原料当前价格和出成率计算完整价格链路", () => {
    const prices = deriveNetIngredientPrices({
      yieldRate: 85,
      processingFeePerJin: 0.35,
      grossMarginRate: null,
      packageSpec: 500,
      sourceIngredient: { pricePerJin: 2 },
    });

    expect(prices).toEqual({
      unitPrice: 2.35,
      grossMarginRate: 0,
      costPricePerJin: 2.7,
      outPricePerJin: 2.7,
      standardPackagePrice: 2.7,
    });
  });

  it("来源原料调价后无需修改净料快照即可获得新价格", () => {
    const prices = deriveNetIngredientPrices({
      yieldRate: 100,
      processingFeePerJin: 0,
      grossMarginRate: 40,
      packageSpec: 500,
      sourceIngredient: { pricePerJin: 4 },
    });

    expect(prices.unitPrice).toBe(4);
    expect(prices.outPricePerJin).toBe(6.67);
  });

  it("序列化覆盖旧单价快照并归一历史空毛利率", () => {
    const serialized = serializeNetIngredient({
      id: 21,
      unitPrice: 99,
      yieldRate: 85,
      processingFeePerJin: 0.35,
      grossMarginRate: null,
      packageSpec: 500,
      sourceIngredient: { pricePerJin: 2 },
    });

    expect(serialized.unitPrice).toBe(2.35);
    expect(serialized.grossMarginRate).toBe(0);
    expect(serialized.costPricePerJin).toBe(2.7);
  });
});
