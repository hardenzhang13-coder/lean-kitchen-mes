import type { PrismaClient } from "@prisma/client";
import {
  buildProductionPlanData,
  planAdjustmentsFromCuttingJson,
} from "../production-plan-utils";

interface MockOptions {
  cuttingOrders?: unknown[];
  purchasePlans?: unknown[];
  schedules?: unknown[];
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
];
const l1 = [
  { code: "VEG", name: "蔬菜" },
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
const potatoNets = (overrides: Record<string, unknown> = {}) => [
  {
    id: 100,
    code: "NET-100",
    name: "土豆丝",
    unit: "g",
    packageSpec: 500,
    l2Code: "VEG-LEF",
    sourceIngredientId: 200,
    yieldRate: 80,
    ...overrides,
  },
];

describe("buildProductionPlanData 行级份数调整", () => {
  it("手工追加净菜：无排程行时生成 manual 行并按出成率折算采购", async () => {
    const prisma = createPrisma({
      nets: potatoNets(),
      ingredients: [potato],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [], [
      { sourceId: 100, portions: 2 },
    ]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0]).toEqual(
      expect.objectContaining({
        sourceType: "net",
        sourceId: 100,
        requiredQty: 1000,
        portions: 2,
        origin: "manual",
        originalPortions: null,
        grossNeedJin: 2.5,
      })
    );
    expect(data.purchase).toHaveLength(1);
    expect(data.purchase[0]).toEqual(
      expect.objectContaining({ sourceType: "ingredient", sourceId: 200, grossNeed: 1250 })
    );
    // 快照仍写 v2，selfProduction 恒为空
    expect(data.sourceSnapshot.version).toBe(2);
    if (data.sourceSnapshot.version === 2) {
      expect(data.sourceSnapshot.stores).toEqual([]);
      expect(data.sourceSnapshot.selfProduction).toEqual([]);
    }
  });

  it("排程行被调整时覆盖份数并保留基线，采购按 delta 重算", async () => {
    const prisma = createPrisma({
      // 基线：排程采购土豆毛需求 625g（对应净需求 500g）；切配 500g = 1 份
      purchasePlans: [
        { scheduleId: 1, sourceType: "ingredient", sourceId: 200, grossNeed: 625 },
      ],
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
      nets: potatoNets(),
      ingredients: [potato],
      l2,
      l1,
    });

    // 1 份 → 3 份：delta 2 份 = 1000g 净需求 → 毛需求 +1250g
    const data = await buildProductionPlanData(prisma, [1], [
      { sourceId: 100, portions: 3 },
    ]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0]).toEqual(
      expect.objectContaining({
        requiredQty: 1500,
        portions: 3,
        origin: "schedule",
        originalPortions: 1,
      })
    );
    expect(data.purchase).toHaveLength(1);
    expect(data.purchase[0].grossNeed).toBe(1875);
  });

  it("排程行不调时无 overlay 字段（回归）", async () => {
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
      nets: potatoNets({ sourceIngredientId: null }),
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [1]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0].portions).toBe(1);
    expect(data.cutting[0].origin).toBeUndefined();
    expect(data.cutting[0].originalPortions).toBeUndefined();
  });

  it("份数调零：行保留，采购毛需求按 0 钳制", async () => {
    const prisma = createPrisma({
      purchasePlans: [
        { scheduleId: 1, sourceType: "ingredient", sourceId: 200, grossNeed: 625 },
      ],
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
      nets: potatoNets(),
      ingredients: [potato],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [1], [
      { sourceId: 100, portions: 0 },
    ]);

    expect(data.cutting).toHaveLength(1);
    expect(data.cutting[0]).toEqual(
      expect.objectContaining({ portions: 0, requiredQty: 0, originalPortions: 1 })
    );
    expect(data.purchase).toHaveLength(1);
    expect(data.purchase[0].grossNeed).toBe(0);
    expect(data.purchase[0].suggestedPurchase).toBe(0);
  });

  it("出成率为 0 时毛需求按净需求退化", async () => {
    const prisma = createPrisma({
      nets: potatoNets({ yieldRate: 0 }),
      ingredients: [potato],
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [], [
      { sourceId: 100, portions: 2 },
    ]);

    expect(data.purchase[0].grossNeed).toBe(1000);
  });

  it("净料缺少封装规格时拒绝生成", async () => {
    const prisma = createPrisma({
      nets: potatoNets({ packageSpec: null }),
      l2,
      l1,
    });

    await expect(
      buildProductionPlanData(prisma, [], [{ sourceId: 100, portions: 1 }])
    ).rejects.toThrow("缺少封装规格");
  });

  it("无来源原料的手工净菜不进采购，仅生成切配行", async () => {
    const prisma = createPrisma({
      nets: potatoNets({ sourceIngredientId: null }),
      l2,
      l1,
    });

    const data = await buildProductionPlanData(prisma, [], [
      { sourceId: 100, portions: 1 },
    ]);

    expect(data.cutting).toHaveLength(1);
    expect(data.purchase).toHaveLength(0);
  });
});

describe("planAdjustmentsFromCuttingJson", () => {
  it("从快照行还原调整，跳过无份数脏行", () => {
    const rows = [
      { sourceType: "net", sourceId: 100, portions: 3 },
      { sourceType: "minor", sourceId: 101, portions: 0 },
      { sourceType: "net", sourceId: 102, portions: null },
      { sourceType: "other", sourceId: 103, portions: 1 },
      "garbage",
    ];
    expect(planAdjustmentsFromCuttingJson(rows)).toEqual([
      { sourceId: 100, portions: 3 },
      { sourceId: 101, portions: 0 },
    ]);
    expect(planAdjustmentsFromCuttingJson(null)).toEqual([]);
    expect(planAdjustmentsFromCuttingJson("x")).toEqual([]);
  });
});
