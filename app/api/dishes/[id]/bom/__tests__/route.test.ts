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

const standardSeasoning = {
  id: 3,
  name: "蒸鱼双椒酱•1200g",
  packageSpec: 1200,
  portion: "小碗菜·10份",
  yieldRate: 100,
  processingFeePerJin: null,
  grossMarginRate: 0,
  sourceIngredientId: 7,
  sourceIngredient: { pricePerJin: 10 },
};

function setupTransaction() {
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
          findMany: jest.fn().mockResolvedValue([
            { id: 7, pricePerJin: 10 },
          ]),
        },
        standardSeasoning: {
          findMany: jest.fn().mockResolvedValue([standardSeasoning]),
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

describe("PUT /api/dishes/[id]/bom — 调料标准化规格口径", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.dish.findUnique.mockResolvedValue({ status: "draft" });
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "SEA-SOL" },
    ]);
    setupTransaction();
  });

  it("带 specId 的调料行：用量强制等于标准规格，成本按出库价折算", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [
          { specId: 3, sourceId: 7, amountG: 999, brand: null },
        ],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const seasoningCreate = createMany.mock.calls.find(
      (call) => call[0]?.data?.[0]?.type === "seasoning"
    );
    expect(seasoningCreate).toBeDefined();
    const row = seasoningCreate?.[0].data[0];
    // 用量 = 标准规格（忽略客户端传的 999）
    expect(row.amountG).toBe(1200);
    expect(row.specId).toBe(3);
    expect(row.sourceId).toBe(7);
    // 成本 = 出库价 10 元/斤 × 1200g ÷ 500 = 24
    expect(row.cost).toBe(24);
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("存量旧口径行（无 specId）：用量与成本沿用来源调料每斤单价", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 7, amountG: 100, brand: null }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const seasoningCreate = createMany.mock.calls.find(
      (call) => call[0]?.data?.[0]?.type === "seasoning"
    );
    const row = seasoningCreate?.[0].data[0];
    expect(row.amountG).toBe(100);
    expect(row.specId).toBeNull();
    // 成本 = 每斤单价 10 元/斤 × 100g ÷ 500 = 2
    expect(row.cost).toBe(2);
  });

  it("specId 指向已删除的标准化调料时拒绝保存", async () => {
    mockedPrisma.$transaction.mockImplementation(async () => {
      throw new Error("标准化调料不存在或已删除（ID 3）");
    });

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 3, sourceId: 7, amountG: 1200 }],
      }),
      params()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("标准化调料不存在");
  });

  it("已发布菜品不可修改 BOM", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValue({ status: "published" });

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 3, sourceId: 7, amountG: 1200 }],
      }),
      params()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不可修改 BOM");
  });
});
