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

/** SEA 调味品体系下的调料：每斤单价 10 元/斤 */
const seasoning = { id: 7, name: "生抽", pricePerJin: 10 };

function setupTransaction(seasonings: Array<typeof seasoning> = [seasoning]) {
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

describe("PUT /api/dishes/[id]/bom — 调料按来源调料 + 克需求口径", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.dish.findUnique.mockResolvedValue({ status: "draft" });
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "SEA-SOL" },
    ]);
    setupTransaction();
  });

  it("调料行：克数按客户端填写，成本按每斤单价折算", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 7, amountG: 10, brand: null }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const row = seasoningRow(createMany);
    expect(row.amountG).toBe(10);
    expect(row.sourceId).toBe(7);
    expect(row.specId).toBeNull();
    // 成本 = 每斤单价 10 元/斤 × 10g ÷ 500 = 0.2
    expect(row.cost).toBe(0.2);
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("旧客户端传的 specId 被忽略，按来源调料 + 克数写入", async () => {
    const { createMany } = setupTransaction();

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ specId: 3, sourceId: 7, amountG: 25 }],
      }),
      params()
    );

    expect(res.status).toBe(200);
    const row = seasoningRow(createMany);
    expect(row.specId).toBeNull();
    expect(row.amountG).toBe(25);
    expect(row.cost).toBe(0.5);
  });

  it("引用的调料不属于调味品体系时拒绝保存", async () => {
    setupTransaction([]);

    const res = await PUT(
      createRequest({
        seasoningDetails: [{ sourceId: 99, amountG: 10 }],
      }),
      params()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不属于调味品分类");
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