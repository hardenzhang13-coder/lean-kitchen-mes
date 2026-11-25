import type { Prisma } from "@prisma/client";
import { syncBomCostsForSeasoningProduct } from "../seasoning-spec-sync";

jest.mock("../bom-package-sync", () => ({
  recalcDishCosts: jest.fn(async () => {}),
}));

import { recalcDishCosts } from "../bom-package-sync";

const mockedRecalcDishCosts = recalcDishCosts as jest.Mock;

function createTx() {
  return {
    dishSeasoningDetail: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, dishId: 10, amountG: 500 },
        { id: 2, dishId: 10, amountG: 1000 },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("syncBomCostsForSeasoningProduct", () => {
  beforeEach(() => {
    mockedRecalcDishCosts.mockClear();
  });

  it("按克用量保留不动，逐行用新出库价重算 BOM 行成本并重算菜品成本", async () => {
    const tx = createTx();

    const result = await syncBomCostsForSeasoningProduct(tx, 3, 10);

    // 行成本 = 出库价(元/斤) × 用量g ÷ 500；用量不随封装规格变更
    expect(tx.dishSeasoningDetail.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { cost: 10 }, // 10 × 500 ÷ 500
    });
    expect(tx.dishSeasoningDetail.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { cost: 20 }, // 10 × 1000 ÷ 500
    });
    expect(mockedRecalcDishCosts).toHaveBeenCalledWith(tx, [10]);
    expect(result).toEqual({ dishIds: [10], rows: 2 });
  });

  it("没有菜品引用时不写库也不重算", async () => {
    const tx = createTx();
    (tx.dishSeasoningDetail.findMany as jest.Mock).mockResolvedValue([]);

    const result = await syncBomCostsForSeasoningProduct(tx, 3, 10);

    expect(result).toEqual({ dishIds: [], rows: 0 });
    expect(tx.dishSeasoningDetail.update).not.toHaveBeenCalled();
    expect(mockedRecalcDishCosts).not.toHaveBeenCalled();
  });

  it("出库价缺失时成本写 null，用量仍保留", async () => {
    const tx = createTx();

    await syncBomCostsForSeasoningProduct(tx, 3, null);

    expect(tx.dishSeasoningDetail.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { cost: null },
    });
  });
});
