import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { PUT } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    dish: { findUnique: jest.fn() },
    ingredientCategoryL2: { findMany: jest.fn() },
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
}));

const mockedLogOperation = logOperation as jest.Mock;

const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  dish: { findUnique: jest.Mock };
  ingredientCategoryL2: { findMany: jest.Mock };
};

/** 旧口径行：直引调味品原料（kind=seasoning），每斤单价 10 元/斤 */
const seasoning = { id: 7, name: "生抽", pricePerJin: 10 };

/** 新口径行：调料产物（转化口径），来源 10 元/斤 ÷ 出成率 80% = 12.5 元/斤，毛利 0 → 出库价 12.5 */
const seasoningProduct = {
  id: 3,
  name: "生抽•500g",
  unitPrice: 12.5,
  yieldRate: 80,
  processingFeePerJin: 0,
  grossMarginRate: 0,
  packageSpec: 500,
  sourceIngredient: { pricePerJin: 10 },
};

function setupTransaction(
  seasonings: Array<typeof seasoning> = [seasoning],
  products: Array<typeof seasoningProduct> = [seasoningProduct]
) {
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  mockedPrisma.$transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        dishNetDetail: {
          deleteMany: jest.fn(),
          createMany,
          findMany: jest.fn().mockResolvedValue([]),
        },
        dishMinorDetail: {
          deleteMany: jest.fn(),
          createMany,
          findMany: jest.fn().mockResolvedValue([]),
        },
        dishSeasoningDetail: {
          deleteMany: jest.fn(),
          createMany,
          findMany: jest.fn().mockResolvedValue([]),
        },
        dishSauceDetail: {
          deleteMany: jest.fn(),
          createMany,
          findMany: jest.fn().mockResolvedValue([]),
        },
        netIngredient: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ingredient: {
          findMany: jest.fn().mockResolvedValue(seasonings),
        },
        seasoningProduct: {
          findMany: jest.fn().mockResolvedValue(products),
        },
        sauceIngredient: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        ingredientCategoryL2: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        dish: { update: jest.fn().mockResolvedValue({}) },
      })
  );
  return { createMany };
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/dishes/1/bom", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function params() {
  return { params: Promise.resolve({ id: "1" }) };
}

function seasoningRow(createMany: jest.Mock) {
  const call = createMany.mock.calls.find(
    (c) => c[0]?.data?.[0]?.type === "seasoning"
  );
  return call?.[0]?.data?.[0];
}

describe("PUT /api/dishes/[id]/bom — 调料双口径（产物 specId / 旧行 sourceId）", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.dish.findUnique.mockResolvedValue({ status: "draft" });
    setupTransaction();
  });

  it("产物行：按产物出库价 × 克数 ÷ 500 计价", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 3, amountG: 10, brand: null }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const row = seasoningRow(createMany);
    expect(row.amountG).toBe(10);
    expect(row.specId).toBe(3);
    // 产物行无来源原料：sourceId 置 0（非空约束保留）
    expect(row.sourceId).toBe(0);
    // 出库价 12.5 × 10g ÷ 500 = 0.25
    expect(row.cost).toBe(0.25);
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("旧口径行：直引调味品原料，按每斤单价 × 克数 ÷ 500 计价", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 7, amountG: 10 }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const row = seasoningRow(createMany);
    expect(row.specId).toBeNull();
    expect(row.sourceId).toBe(7);
    // 成本 = 每斤单价 10 × 10g ÷ 500 = 0.2
    expect(row.cost).toBe(0.2);
  });

  it("specId 与 sourceId 同传时以产物口径为准", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 3, sourceId: 7, amountG: 25 }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const row = seasoningRow(createMany);
    expect(row.specId).toBe(3);
    // 出库价 12.5 × 25g ÷ 500 = 0.625
    expect(row.cost).toBe(0.625);
  });

  it("引用的调料产物不存在时拒绝保存", async () => {
    setupTransaction([seasoning], []);

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 9, amountG: 10 }],
      }),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("调料产物不存在或已删除");
  });

  it("旧行引用的原料不属于调味品体系时拒绝保存", async () => {
    setupTransaction([], [seasoningProduct]);

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 99, amountG: 10 }],
      }),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不属于调味品体系");
  });

  it("缺少克数时拒绝保存", async () => {
    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 7 }],
      }),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("输入校验失败");
  });

  it("已发布菜品不可修改 BOM", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValue({ status: "published" });

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 7, amountG: 10 }],
      }),
      params()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不可修改 BOM");
  });
});