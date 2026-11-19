import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { syncBomAmountsForStandardSeasoning } from "@/lib/server/seasoning-spec-sync";
import { recalcIncompleteDocumentsForStandardSeasoning } from "@/lib/server/seasoning-spec-recalc";
import { DELETE, GET, PUT } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    standardSeasoning: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    ingredient: {
      findFirst: jest.fn(),
    },
    ingredientCategoryL2: {
      findMany: jest.fn(),
    },
    dishSeasoningDetail: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
}));

jest.mock("@/lib/server/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("@/lib/server/seasoning-spec-sync", () => ({
  syncBomAmountsForStandardSeasoning: jest.fn(),
}));

jest.mock("@/lib/server/seasoning-spec-recalc", () => ({
  recalcIncompleteDocumentsForStandardSeasoning: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  standardSeasoning: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  ingredient: { findFirst: jest.Mock };
  ingredientCategoryL2: { findMany: jest.Mock };
  dishSeasoningDetail: { count: jest.Mock; groupBy: jest.Mock };
};
const mockedLogOperation = logOperation as jest.Mock;
const mockedSync = syncBomAmountsForStandardSeasoning as jest.Mock;
const mockedRecalc = recalcIncompleteDocumentsForStandardSeasoning as jest.Mock;

const existing = {
  id: 3,
  code: "SEA-SP-0001",
  name: "蒸鱼双椒酱•1200g",
  sourceIngredientId: 7,
  packageSpec: 1200,
  portion: "小碗菜·10份",
  yieldRate: 100,
  unitPrice: 10,
  processingFeePerJin: null,
  grossMarginRate: 0,
  l2Code: "SEA-SOL",
  storage: "常温",
};

const source = {
  id: 7,
  name: "蒸鱼双椒酱",
  l2Code: "SEA-SOL",
  pricePerJin: 10,
};

function params(id = "3") {
  return { params: Promise.resolve({ id }) };
}

function createRequest(body: unknown, method = "PUT"): NextRequest {
  return new NextRequest(
    "http://localhost:3000/api/standard-seasonings/3",
    {
      method,
      body: JSON.stringify(body),
    }
  );
}

describe("GET /api/standard-seasonings/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("不存在时返回 404", async () => {
    mockedPrisma.standardSeasoning.findFirst.mockResolvedValue(null);
    const res = await GET(
      new NextRequest("http://localhost:3000/api/standard-seasonings/3"),
      params()
    );
    expect(res.status).toBe(404);
  });

  it("返回详情与派生价格", async () => {
    mockedPrisma.standardSeasoning.findFirst.mockResolvedValue({
      ...existing,
      sourceIngredient: source,
    });
    const res = await GET(
      new NextRequest("http://localhost:3000/api/standard-seasonings/3"),
      params()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.standardPackagePrice).toBe(24);
    expect(body.data.dishCount).toBeUndefined();
  });
});

describe("PUT /api/standard-seasonings/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "SEA-SOL" },
      { code: "SEA-LIQ" },
    ]);
    mockedPrisma.ingredient.findFirst.mockResolvedValue(source);
    mockedSync.mockResolvedValue({ dishIds: [10], rows: 1 });
    mockedRecalc.mockResolvedValue({ scheduleIds: [1], planIds: [] });
  });

  function setupTransaction(overrides: Record<string, unknown> = {}) {
    mockedPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          standardSeasoning: {
            findFirst: jest.fn().mockResolvedValue(existing),
            update: jest.fn().mockResolvedValue({
              ...existing,
              ...overrides,
              sourceIngredient: source,
            }),
          },
          ingredient: {
            findFirst: jest.fn().mockResolvedValue(source),
            findUnique: jest.fn().mockResolvedValue({ pricePerJin: 10 }),
          },
          ingredientCategoryL2: {
            findMany: jest
              .fn()
              .mockResolvedValue([{ code: "SEA-SOL" }]),
          },
        })
    );
  }

  it("标准规格变化时联动 BOM 行并重建单据", async () => {
    setupTransaction({ packageSpec: 1500, unitPrice: 10 });

    const res = await PUT(createRequest({ packageSpec: 1500 }), params());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.packageSpec).toBe(1500);
    expect(body.data.sync.updatedBomRows).toBe(1);
    expect(body.data.sync.rebuiltScheduleIds).toEqual([1]);
    expect(mockedSync).toHaveBeenCalledWith(
      expect.anything(),
      3,
      1500,
      expect.any(Number)
    );
    expect(mockedRecalc).toHaveBeenCalledWith(expect.anything(), 3);
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("只有名称变化时不触发 BOM 联动", async () => {
    setupTransaction({ name: "新名字" });

    const res = await PUT(createRequest({ name: "新名字" }), params());
    expect(res.status).toBe(200);
    expect(mockedSync).not.toHaveBeenCalled();
    expect(mockedRecalc).not.toHaveBeenCalled();
  });

  it("记录不存在时返回 404", async () => {
    mockedPrisma.$transaction.mockImplementation(async () => {
      throw new Error("标准化调料不存在或已删除");
    });
    const res = await PUT(createRequest({ name: "新名字" }), params());
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/standard-seasonings/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("被菜品引用时拒绝删除", async () => {
    mockedPrisma.standardSeasoning.findFirst.mockResolvedValue(existing);
    mockedPrisma.dishSeasoningDetail.count.mockResolvedValue(2);

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/standard-seasonings/3", {
        method: "DELETE",
      }),
      params()
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("无法删除");
    expect(mockedPrisma.standardSeasoning.update).not.toHaveBeenCalled();
  });

  it("无引用时软删除并记录日志", async () => {
    mockedPrisma.standardSeasoning.findFirst.mockResolvedValue(existing);
    mockedPrisma.dishSeasoningDetail.count.mockResolvedValue(0);
    mockedPrisma.standardSeasoning.update.mockResolvedValue({});

    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/standard-seasonings/3", {
        method: "DELETE",
      }),
      params()
    );
    expect(res.status).toBe(200);
    expect(mockedPrisma.standardSeasoning.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockedLogOperation).toHaveBeenCalled();
  });
});
