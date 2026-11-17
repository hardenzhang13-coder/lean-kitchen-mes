import type { PrismaClient } from "@prisma/client";
import { buildProductionPlanData } from "../production-plan-utils";

interface MockOptions {
  cuttingOrders?: unknown[];
  purchasePlans?: unknown[];
  schedules?: unknown[];
  selfOrders?: unknown[];
  nets?: unknown[];
  ingredients?: unknown[];
  l2?: unknown[];
  l1?: unknown[];
}

function createPrisma(options: MockOptions) {
  return {
    cuttingOrder: { findMany: jest.fn().mockResolvedValue(options.cuttingOrders ?? []) },
    purchasePlan: { findMany: jest.fn().mockResolvedValue(options.purchasePlans ?? []) },
    schedule: { findMany: jest.fn().mockResolvedValue(options.schedules ?? []) },
    selfProductionOrder: {
      findMany: jest.fn().mockResolvedValue(options.selfOrders ?? []),
    },
    netIngredient: { findMany: jest.fn().mockResolvedValue(options.nets ?? []) },
    ingredient: { findMany: jest.fn().mockResolvedValue(options.ingredients ?? []) },
    sauceIngredient: { findMany: jest.fn().mockResolvedValue([]) },
    ingredientCategoryL2: { findMany: jest.fn().mockResolvedValue(options.l2 ?? []) },
    ingredientCategoryL1: { findMany: jest.fn().mockResolvedValue(options.l1 ?? []) },
    unit: {
      findMany: jest.fn().mockResolvedValue([{ name: "斤", gramsPerUnit: 500 }]),
      findUnique: jest.fn().mockResolvedValue({ gramsPerUnit: 500, isActive: true }),
    },
  } as unknown as PrismaClient;
}

const l2 = [
  { code: "VEG-LEF", name: "叶菜类", parentCode: "VEG" },
  { code: "MIN-GAR", name: "姜蒜类", parentCode: "MIN" },
];
const l1 = [
  { code: "VEG", name: "蔬菜" },
  { code: "MIN", name: "小料" },
];
const potato = {
  id: 200,
  code: "ING-200",
  name: "土豆",
  l2Code: "VEG-LEF",
  purchaseUnit: "斤",
  purchaseSpec: null,
  pricePerJin: 5,
  latestRefPrice: null,
  defaultSupplierId: null,
  defaultSupplier: null,
};

function selfOrder(portions: number, sourceId = 100) {
  return [
    {
      id: 10,
      code: "SPO-20261118-001",
      title: "切配中心·周三（11月18日）内部生产单",
      produceDate: new Date("2026-11-18T00:00:00.000Z"),
      remark: null,
      items: [{ sourceType: "net", sourceId, portions }],
    },
  ];
}

describe("buildProductionPlanData 内部生产接入", () => {
  it("只有内部生产单时也能生成切配、采购与 v2 快照", async () => {
    const prisma = createPrisma({
      selfOrders: selfOrder(2),
      nets: [
        {
          id: 100,
          code: "NET-100",
          name: "土豆丝",
          unit: "g",
          packageSpec: 500,
          l2Code: "VEG-LEF",
          sourceIngredientId: 200,
          yieldRate: 80,
        },
      ],
      ingredients: [potato],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [], [10]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0]).toEqual(
      expect.objectContaining({
        sourceType: "net",
        sourceId: 100,
        requiredQty: 1000,
        portions: 2,
        grossNeedJin: 2.5,
      })
    );
    expect(data.purchase).toHaveLength(1);
    expect(data.purchase[0]).toEqual(
      expect.objectContaining({ sourceType: "ingredient", sourceId: 200, grossNeed: 1250 })
    );
    expect(data.sourceSnapshot.version).toBe(2);
    if (data.sourceSnapshot.version === 2) {
      expect(data.sourceSnapshot.stores).toEqual([]);
      expect(data.sourceSnapshot.selfProduction).toHaveLength(1);
      expect(data.sourceSnapshot.selfProduction[0].items[0].requiredQty).toBe(1000);
    }
  });

  it("同一净料同时来自排程与内部生产时按 key 合并份数", async () => {
    const prisma = createPrisma({
      cuttingOrders: [{ scheduleId: 1, sourceType: "net", sourceId: 100, requiredQty: 500 }],
      schedules: [
        {
          id: 1,
          code: "SCH-20261118-001",
          title: "甲门店 · 周三（11月18日）·菜单",
          scheduleDate: new Date("2026-11-18T00:00:00.000Z"),
          store: { id: 1, name: "甲门店" },
          items: [],
        },
      ],
      selfOrders: selfOrder(1),
      nets: [
        {
          id: 100,
          code: "NET-100",
          name: "土豆丝",
          unit: "g",
          packageSpec: 500,
          l2Code: "VEG-LEF",
          sourceIngredientId: null,
          yieldRate: 80,
        },
      ],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [1], [10]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0].requiredQty).toBe(1000);
    expect(data.cutting[0].portions).toBe(2);
    expect(data.purchase).toHaveLength(0); // 无来源原料，不进采购
    if (data.sourceSnapshot.version === 2) {
      expect(data.sourceSnapshot.stores).toHaveLength(1);
      expect(data.sourceSnapshot.selfProduction).toHaveLength(1);
    }
  });

  it("出成率为 0 时毛需求按净需求退化", async () => {
    const prisma = createPrisma({
      selfOrders: selfOrder(2),
      nets: [
        {
          id: 100,
          code: "NET-100",
          name: "土豆丝",
          unit: "g",
          packageSpec: 500,
          l2Code: "VEG-LEF",
          sourceIngredientId: 200,
          yieldRate: 0,
        },
      ],
      ingredients: [potato],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [], [10]);

    expect(data.purchase[0].grossNeed).toBe(1000);
  });

  it("净料缺少封装规格时拒绝生成", async () => {
    const prisma = createPrisma({
      selfOrders: selfOrder(1),
      nets: [
        {
          id: 100,
          code: "NET-100",
          name: "土豆丝",
          unit: "g",
          packageSpec: null,
          l2Code: "VEG-LEF",
          sourceIngredientId: 200,
          yieldRate: 80,
        },
      ],
      l2,
      l1,
    });

    await expect(buildProductionPlanData(prisma, [], [10])).rejects.toThrow(
      "缺少封装规格"
    );
  });
});
