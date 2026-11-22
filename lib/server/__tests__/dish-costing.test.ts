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
  seasoningDetails: Array<{ dishId: number; sourceId: number; amountG: number }>
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
});