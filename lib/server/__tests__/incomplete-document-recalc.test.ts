import type { Prisma } from "@prisma/client";
import {
  BomSyncConflictError,
  recalcIncompleteDocumentsForNetIngredient,
} from "../incomplete-document-recalc";
import { buildCuttingOrders, buildPurchasePlans } from "../schedule-utils";
import { buildProductionPlanData } from "../production-plan-utils";

jest.mock("../schedule-utils", () => ({
  buildCuttingOrders: jest.fn(),
  buildPurchasePlans: jest.fn(),
}));
jest.mock("../production-plan-utils", () => ({
  buildProductionPlanData: jest.fn(),
  planAdjustmentsFromCuttingJson: jest.requireActual<typeof import("../production-plan-utils")>(
    "../production-plan-utils"
  ).planAdjustmentsFromCuttingJson,
}));

const mockedCutting = buildCuttingOrders as jest.Mock;
const mockedPurchase = buildPurchasePlans as jest.Mock;
const mockedPlanData = buildProductionPlanData as jest.Mock;

function createTx() {
  return {
    dishNetDetail: { findMany: jest.fn().mockResolvedValue([{ dishId: 1 }]) },
    dishMinorDetail: { findMany: jest.fn().mockResolvedValue([]) },
    ingredientCategoryL2: {
      findMany: jest.fn().mockResolvedValue([{ code: "SEA-SOL" }]),
    },
    schedule: {
      findMany: jest.fn().mockResolvedValue([
        { id: 5, code: "SCH-001", items: [{ dishId: 1, quantity: 3 }] },
      ]),
    },
    cuttingOrder: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    purchasePlan: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    outboundOrder: { count: jest.fn().mockResolvedValue(0) },
    scheduleItem: { count: jest.fn().mockResolvedValue(0) },
    selfProductionItem: { findMany: jest.fn().mockResolvedValue([]) },
    productionPlan: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 9,
          code: "PPL-001",
          cuttingJson: [],
          schedules: [{ scheduleId: 5 }],
          selfOrders: [],
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("recalcIncompleteDocumentsForNetIngredient", () => {
  beforeEach(() => {
    mockedCutting.mockReset().mockResolvedValue([{ scheduleId: 5 }]);
    mockedPurchase.mockReset().mockResolvedValue([{ scheduleId: 5 }]);
    mockedPlanData.mockReset().mockResolvedValue({
      cutting: [],
      purchase: [],
      sourceSnapshot: { version: 2, stores: [], selfProduction: [] },
    });
  });

  it("重建待生效/进行中的排程与生产计划", async () => {
    const tx = createTx();

    const result = await recalcIncompleteDocumentsForNetIngredient(tx, 100);

    expect(mockedCutting).toHaveBeenCalledWith(tx, 5, [{ dishId: 1, quantity: 3 }]);
    expect(mockedPurchase).toHaveBeenCalledWith(tx, 5, [{ dishId: 1, quantity: 3 }]);
    expect(tx.cuttingOrder.deleteMany).toHaveBeenCalledWith({ where: { scheduleId: 5 } });
    expect(tx.purchasePlan.deleteMany).toHaveBeenCalledWith({ where: { scheduleId: 5 } });
    expect(tx.cuttingOrder.createMany).toHaveBeenCalled();
    expect(tx.purchasePlan.createMany).toHaveBeenCalled();
    expect(tx.productionPlan.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: {
        cuttingJson: [],
        purchaseJson: [],
        sourceScheduleJson: { version: 2, stores: [], selfProduction: [] },
      },
    });
    expect(result).toEqual({ scheduleIds: [5], planIds: [9] });
  });

  it("排程已有生产进度时抛 409，不覆盖单据", async () => {
    const tx = createTx();
    (tx.cuttingOrder.count as jest.Mock).mockResolvedValue(1);

    await expect(
      recalcIncompleteDocumentsForNetIngredient(tx, 100)
    ).rejects.toBeInstanceOf(BomSyncConflictError);
    expect(tx.cuttingOrder.deleteMany).not.toHaveBeenCalled();
    expect(tx.productionPlan.update).not.toHaveBeenCalled();
  });

  it("生产计划已有确认进度时抛 409", async () => {
    const tx = createTx();
    (tx.productionPlan.findMany as jest.Mock).mockResolvedValue([
      {
        id: 9,
        code: "PPL-001",
        cuttingJson: [{ confirmStatus: "completed" }],
        schedules: [{ scheduleId: 5 }],
        selfOrders: [],
      },
    ]);

    await expect(
      recalcIncompleteDocumentsForNetIngredient(tx, 100)
    ).rejects.toBeInstanceOf(BomSyncConflictError);
    expect(tx.productionPlan.update).not.toHaveBeenCalled();
  });
});
