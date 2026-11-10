import { formatPortions } from "../../shared/weight-format";
import type { PrismaClient } from "@prisma/client";
import { buildCuttingOrders, buildPurchasePlans } from "../schedule-utils";

// 单位字典 mock：斤=500g、公斤/kg=1000g、克/g=1g
jest.mock("../unit-factors", () => ({
  getJinFactors: jest.fn(async () => ({ "斤": 1, "公斤": 2, kg: 2, "克": 0.002, g: 0.002 })),
  getGramsPerJin: jest.fn(async () => 500),
  getWeightUnitNames: jest.fn(async () => new Set(["斤", "公斤", "kg", "克", "g"])),
}));

/**
 * 构造最小可用的 Prisma mock：仅实现 schedule-utils 查询用到的方法。
 */
function makePrismaMock(overrides: {
  netDetails?: unknown[];
  minorDetails?: unknown[];
  seasoningDetails?: unknown[];
  seasonings?: unknown[];
  sauces?: unknown[];
  inventories?: unknown[];
  l2Cats?: unknown[];
  l1Cats?: unknown[];
}) {
  const db = {
    dishNetDetail: { findMany: jest.fn(async () => overrides.netDetails ?? []) },
    dishMinorDetail: { findMany: jest.fn(async () => overrides.minorDetails ?? []) },
    ingredientCategoryL2: { findMany: jest.fn(async () => overrides.l2Cats ?? []) },
    ingredientCategoryL1: { findMany: jest.fn(async () => overrides.l1Cats ?? []) },
    dishSeasoningDetail: { findMany: jest.fn(async () => overrides.seasoningDetails ?? []) },
    ingredient: { findMany: jest.fn(async () => overrides.seasonings ?? []) },
    sauceIngredient: { findMany: jest.fn(async () => overrides.sauces ?? []) },
    inventory: { findMany: jest.fn(async () => overrides.inventories ?? []) },
    dishSauceDetail: { findMany: jest.fn(async () => []) },
  };
  return db as unknown as PrismaClient;
}

const L2_CATS = [{ code: "POR", name: "猪肉", parentCode: "MEAT" }];
const L1_CATS = [{ code: "MEAT", name: "畜禽肉类" }];

describe("buildCuttingOrders", () => {
  it("按净料聚合用量，并携带档案编码与封装规格", async () => {
    const prisma = makePrismaMock({
      netDetails: [
        {
          dishId: 1,
          spec: "丝 · 3mm",
          amountG: 300,
          netIngredient: {
            id: 12,
            code: "NET-0012",
            name: "猪里脊肉丝",
            unit: "g",
            l2Code: "POR",
            packageSpec: 250,
          },
        },
        {
          dishId: 1,
          spec: "",
          amountG: 200,
          netIngredient: {
            id: 12,
            code: "NET-0012",
            name: "猪里脊肉丝",
            unit: "g",
            l2Code: "POR",
            packageSpec: 250,
          },
        },
      ],
      l2Cats: L2_CATS,
      l1Cats: L1_CATS,
    });

    const rows = await buildCuttingOrders(prisma, 99, [{ dishId: 1, quantity: 10 }]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      scheduleId: 99,
      sourceType: "net",
      sourceId: 12,
      itemName: "猪里脊肉丝",
      sourceCode: "NET-0012",
      packageSpec: 250,
      requiredQty: 5000, // (300+200) × 10
      unit: "g",
    });
  });

  it("小料规格取自净料档案 spec 字段", async () => {
    const prisma = makePrismaMock({
      minorDetails: [
        {
          dishId: 1,
          amountG: 5,
          netIngredient: {
            id: 40,
            code: "MIN-0040",
            name: "葱花",
            unit: "g",
            l2Code: "POR",
            spec: "花",
            packageSpec: 50,
          },
        },
      ],
      l2Cats: L2_CATS,
      l1Cats: L1_CATS,
    });

    const rows = await buildCuttingOrders(prisma, 1, [{ dishId: 1, quantity: 46 }]);

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceCode).toBe("MIN-0040");
    expect(rows[0].packageSpec).toBe(50);
    expect(rows[0].requiredQty).toBe(230);
  });
});

describe("buildPurchasePlans", () => {
  // 前腿散称案例：出成率 80%，净需求 2500g → 毛料 3125g = 6.25 斤；库存抵扣已下线（v002），按毛需求采购
  it("出成率百分数口径 + 散称按斤建议（库存抵扣已下线）", async () => {
    const prisma = makePrismaMock({
      netDetails: [
        {
          dishId: 1,
          amountG: 250,
          netIngredient: {
            id: 12,
            yieldRate: 80,
            sourceIngredientId: 102,
            sourceIngredient: {
              id: 102,
              code: "RAW-0102",
              name: "带皮前腿",
              stockUnit: "斤",
              purchaseUnit: "斤",
              purchaseSpec: "散称",
              l2Code: "POR",
              unitsPerPurchase: 1,
              pricePerJin: 7.2,
              defaultSupplierId: 7,
              defaultSupplier: { name: "京鲜肉联配送中心" },
            },
          },
        },
      ],
      inventories: [{ ingredientId: 102, currentQty: 2 }],
      l2Cats: L2_CATS,
      l1Cats: L1_CATS,
    });

    const rows = await buildPurchasePlans(prisma, 5, [{ dishId: 1, quantity: 10 }], []);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.grossNeed).toBe(3125); // 2500 × 100 ÷ 80（克）
    expect(row.stockDeducted).toBe(0); // 库存抵扣已下线，恒 0
    expect(row.suggestedPurchase).toBe(6.25); // 毛需求（斤）
    expect(row.unit).toBe("斤");
    expect(row.estimatedAmount).toBe(45); // 6.25 × 7.2
    expect(row.supplierId).toBe(7);
    expect(row.supplierName).toBe("京鲜肉联配送中心");
  });

  // 螺丝椒案例：出成率 80%，净需求 12500g → 毛料 25 斤，19斤/箱 → 向上取整 2 箱
  it("克 → 采购单位换算，向上取整", async () => {
    const prisma = makePrismaMock({
      netDetails: [
        {
          dishId: 1,
          amountG: 1250,
          netIngredient: {
            id: 11,
            yieldRate: 80,
            sourceIngredientId: 127,
            sourceIngredient: {
              id: 127,
              code: "RAW-0427",
              name: "螺丝椒",
              stockUnit: "箱",
              purchaseUnit: "箱",
              purchaseSpec: "19斤/箱",
              l2Code: "POR",
              unitsPerPurchase: 1,
              latestRefPrice: 56,
              pricePerJin: 2.9474,
              defaultSupplierId: null,
              defaultSupplier: null,
            },
          },
        },
      ],
      l2Cats: L2_CATS,
      l1Cats: L1_CATS,
    });

    const rows = await buildPurchasePlans(prisma, 5, [{ dishId: 1, quantity: 10 }], []);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.grossNeed).toBe(15625); // 12500 × 100 ÷ 80
    expect(row.suggestedPurchase).toBe(2); // 31.25 斤 ÷ 19斤/箱 → 2 箱
    expect(row.unit).toBe("箱");
    expect(row.estimatedAmount).toBe(112); // 2 箱 × 56 元/箱
  });

  // 盐案例：库存抵扣已下线（v002）→ 按毛需求 0.2 斤建议最小采购单位 1 件
  it("调料不再抵扣库存（库存抵扣已下线）", async () => {
    const prisma = makePrismaMock({
      seasoningDetails: [{ dishId: 1, sourceId: 30, amountG: 100 }],
      seasonings: [
        {
          id: 30,
          code: "SEA-0030",
          name: "盐",
          l2Code: "SEA",
          purchaseUnit: "件",
          stockUnit: "包",
          purchaseSpec: "500g/包*50包",
          unitsPerPurchase: 50,
          latestRefPrice: 75,
          pricePerJin: 1.5,
          defaultSupplierId: null,
          defaultSupplier: null,
        },
      ],
      inventories: [{ ingredientId: 30, currentQty: 3 }],
    });

    const rows = await buildPurchasePlans(prisma, 5, [{ dishId: 1, quantity: 1 }], ["SEA"]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.grossNeed).toBe(100); // 克
    expect(row.stockDeducted).toBe(0); // 库存抵扣已下线，恒 0
    expect(row.suggestedPurchase).toBe(1); // 0.2 斤 → 最小采购单位 1 件
    expect(row.estimatedAmount).toBe(75); // 1 件 × 参考单价 75
  });

  // 生抽案例：液体规格无法换算重量 → 最小采购单位 1 件
  it("规格无法换算为采购单位时按斤建议", async () => {
    const prisma = makePrismaMock({
      seasoningDetails: [{ dishId: 1, sourceId: 28, amountG: 150 }],
      seasonings: [
        {
          id: 28,
          code: "SEA-0028",
          name: "海天金标生抽",
          l2Code: "SEA",
          purchaseUnit: "件",
          stockUnit: "瓶",
          purchaseSpec: "1.9升*6瓶",
          unitsPerPurchase: 6,
          latestRefPrice: 105,
          pricePerJin: 4.61,
          defaultSupplierId: null,
          defaultSupplier: null,
        },
      ],
    });

    const rows = await buildPurchasePlans(prisma, 5, [{ dishId: 1, quantity: 1 }], ["SEA"]);

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.grossNeed).toBe(150);
    expect(row.suggestedPurchase).toBe(1); // 计件标品无法换算重量 → 最小采购单位 1 件
    expect(row.unit).toBe("件");
    expect(row.estimatedAmount).toBe(105); // 1 件 × 105 元/件
  });
});

describe("formatPortions", () => {
  it("整份 + 零头 / 零配 / 整份三种形态", () => {
    expect(formatPortions(1000, 700)).toBe("1 份 + 300 g");
    expect(formatPortions(800, 1000)).toBe("零配 800 g");
    expect(formatPortions(1400, 700)).toBe("2 份");
    expect(formatPortions(100, 500)).toBe("零配 100 g");
    expect(formatPortions(300, 100)).toBe("3 份");
  });
});
