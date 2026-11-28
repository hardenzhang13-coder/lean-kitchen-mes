import type { Prisma } from "@prisma/client";
import { syncBomAmountsForNetIngredient } from "../bom-package-sync";
import { getCurrentDishCostBreakdownMap } from "../dish-costing";

jest.mock("../dish-costing", () => ({
  getCurrentDishCostBreakdownMap: jest.fn(),
}));

const mockedCostMap = getCurrentDishCostBreakdownMap as jest.Mock;

function createTx() {
  return {
    netIngredient: {
      findUnique: jest.fn().mockResolvedValue({
        id: 100,
        yieldRate: 80,
        processingFeePerJin: 1,
        grossMarginRate: 20,
        sourceIngredient: { pricePerJin: 10 },
      }),
    },
    dishNetDetail: {
      // 小料行已并入 dish_net_details（role='minor'）
      findMany: jest.fn().mockResolvedValue([
        { id: 1, dishId: 10, role: "main" },
        { id: 2, dishId: 10, role: "support" },
        { id: 3, dishId: 20, role: "minor" },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    dish: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("syncBomAmountsForNetIngredient", () => {
  beforeEach(() => {
    mockedCostMap.mockReset();
    mockedCostMap.mockResolvedValue(
      new Map([
        [10, { total: 12.5 }],
        [20, { total: 3.2 }],
      ])
    );
  });

  it("把引用该净料的 BOM 行同步到新规格并重算菜品成本（小料行不写 spec 文本）", async () => {
    const tx = createTx();

    const result = await syncBomAmountsForNetIngredient(tx, 100, 600);

    // 主料/辅料行：同步规格文本
    expect(tx.dishNetDetail.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: expect.objectContaining({
        amountG: 600,
        spec: "600g",
        cost: expect.any(Number),
      }),
    });
    // 小料行：只同步用量与成本，spec 恒为 NULL
    expect(tx.dishNetDetail.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [3] } },
      data: expect.objectContaining({
        amountG: 600,
        cost: expect.any(Number),
      }),
    });
    expect(mockedCostMap).toHaveBeenCalledWith([10, 20], tx);
    expect(tx.dish.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { cost: 12.5 },
    });
    expect(tx.dish.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { cost: 3.2 },
    });
    expect(result).toEqual({
      dishIds: [10, 20],
      netRows: 2,
      minorRows: 1,
    });
  });

  it("没有菜品引用时只返回空结果", async () => {
    const tx = createTx();
    (tx.dishNetDetail.findMany as jest.Mock).mockResolvedValue([]);

    const result = await syncBomAmountsForNetIngredient(tx, 100, 600);

    expect(result).toEqual({ dishIds: [], netRows: 0, minorRows: 0 });
    expect(tx.dishNetDetail.updateMany).not.toHaveBeenCalled();
    expect(mockedCostMap).not.toHaveBeenCalled();
  });
});
