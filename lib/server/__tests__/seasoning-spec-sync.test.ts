import type { Prisma } from "@prisma/client";
import { syncBomAmountsForStandardSeasoning } from "../seasoning-spec-sync";
import { getCurrentDishCostBreakdownMap } from "../dish-costing";

jest.mock("../dish-costing", () => ({
  getCurrentDishCostBreakdownMap: jest.fn(),
}));

const mockedCostMap = getCurrentDishCostBreakdownMap as jest.Mock;

function createTx() {
  return {
    dishSeasoningDetail: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, dishId: 10 },
        { id: 2, dishId: 10 },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    dish: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("syncBomAmountsForStandardSeasoning", () => {
  beforeEach(() => {
    mockedCostMap.mockReset();
    mockedCostMap.mockResolvedValue(new Map([[10, { total: 24 }]]));
  });

  it("把引用该标准化调料的 BOM 行同步到新标准规格并重算菜品成本", async () => {
    const tx = createTx();

    const result = await syncBomAmountsForStandardSeasoning(tx, 3, 1500, 10);

    expect(tx.dishSeasoningDetail.updateMany).toHaveBeenCalledWith({
      where: { specId: 3 },
      data: {
        amountG: 1500,
        cost: 30,
      },
    });
    expect(mockedCostMap).toHaveBeenCalledWith([10], tx);
    expect(tx.dish.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { cost: 24 },
    });
    expect(result).toEqual({ dishIds: [10], rows: 2 });
  });

  it("没有菜品引用时不写库也不重算", async () => {
    const tx = createTx();
    (tx.dishSeasoningDetail.findMany as jest.Mock).mockResolvedValue([]);

    const result = await syncBomAmountsForStandardSeasoning(tx, 3, 1500, 10);

    expect(result).toEqual({ dishIds: [], rows: 0 });
    expect(tx.dishSeasoningDetail.updateMany).not.toHaveBeenCalled();
    expect(mockedCostMap).not.toHaveBeenCalled();
  });

  it("出库价缺失时成本写 null", async () => {
    const tx = createTx();

    await syncBomAmountsForStandardSeasoning(tx, 3, 1500, null);

    expect(tx.dishSeasoningDetail.updateMany).toHaveBeenCalledWith({
      where: { specId: 3 },
      data: { amountG: 1500, cost: null },
    });
  });
});
