import { prisma } from "@/lib/server/prisma";
import { getCurrentDishCostBreakdownMap } from "../dish-costing";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    ingredientCategoryL2: { findMany: jest.fn() },
    sauceIngredient: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  ingredientCategoryL2: { findMany: jest.Mock };
  sauceIngredient: { findMany: jest.Mock };
};

function buildDatabase(
  seasoningDetails: Array<{
    dishId: number;
    sourceId: number;
    amountG: number;
    specId?: number | null;
    product?: unknown;
  }>
) {
  return {
    dishNetDetail: { findMany: jest.fn().mockResolvedValue([]) },
    dishMinorDetail: { findMany: jest.fn().mockResolvedValue([]) },
    dishSeasoningDetail: { findMany: jest.fn().mockResolvedValue(seasoningDetails) },
    dishSauceDetail: { findMany: jest.fn().mockResolvedValue([]) },
    ingredient: {
      findMany: jest.fn().mockResolvedValue([
        { id: 30, pricePerJin: 10 },
        { id: 31, pricePerJin: 4 },
      ]),
    },
    sauceIngredient: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe("菜品成本汇总 · 调料按每斤单价 × 克需求", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "SEA-SOL" },
    ]);
  });

  it("调料成本 = 每斤单价 × 克需求 ÷ 500", async () => {
    const database = buildDatabase([
      { dishId: 1, sourceId: 30, amountG: 10 },
      { dishId: 1, sourceId: 31, amountG: 5 },
    ]);

    const result = await getCurrentDishCostBreakdownMap([1], database as never);

    const breakdown = result.get(1);
    expect(breakdown).toBeDefined();
    // 10 元/斤 × 10g ÷ 500 = 0.2；4 元/斤 × 5g ÷ 500 = 0.04
    expect(breakdown?.seasoning).toBe(0.24);
    expect(breakdown?.total).toBe(0.24);
  });

  it("缺少每斤单价的调料不计入成本", async () => {
    const database = buildDatabase([
      { dishId: 1, sourceId: 30, amountG: 10 },
      { dishId: 1, sourceId: 999, amountG: 5 },
    ]);

    const result = await getCurrentDishCostBreakdownMap([1], database as never);

    expect(result.get(1)?.seasoning).toBe(0.2);
  });

  it("混合口径：产物行按出库价计价 + 旧口径行按原料每斤单价计价", async () => {
    const database = buildDatabase([
      // 旧口径行：10 元/斤 × 10g ÷ 500 = 0.2
      { dishId: 1, sourceId: 30, amountG: 10, specId: null },
      // 转化产物行：出库价 = 10 ÷ 0.8 = 12.5 元/斤 × 20g ÷ 500 = 0.5
      {
        dishId: 1,
        sourceId: 0,
        amountG: 20,
        specId: 50,
        product: {
          sourceMode: "transform",
          yieldRate: 80,
          processingFeePerJin: null,
          grossMarginRate: 0,
          sourceIngredient: { pricePerJin: 10 },
        },
      },
      // 外购产物行：出库价 = 8 元/斤 × 25g ÷ 500 = 0.4
      {
        dishId: 1,
        sourceId: 0,
        amountG: 25,
        specId: 51,
        product: {
          sourceMode: "purchase",
          pricePerJin: 8,
          processingFeePerJin: null,
          grossMarginRate: 0,
          sourceIngredient: null,
        },
      },
    ]);

    const result = await getCurrentDishCostBreakdownMap([1], database as never);

    const breakdown = result.get(1);
    // 0.2 + 0.5 + 0.4
    expect(breakdown?.seasoning).toBe(1.1);
    expect(breakdown?.total).toBe(1.1);
  });
});