import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";
import { createDishVariant } from "@/lib/server/dish-variant";
import { POST } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    dish: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
  getUserFromRequest: jest.fn(() => ({ username: "admin" })),
}));

jest.mock("@/lib/server/dish-costing", () => ({
  getCurrentDishCostMap: jest.fn(),
}));

jest.mock("@/lib/server/dish-variant", () => ({
  createDishVariant: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  dish: { findUnique: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};
const mockedLogOperation = logOperation as jest.Mock;
const mockedCostMap = getCurrentDishCostMap as jest.Mock;
const mockedCreateVariant = createDishVariant as jest.Mock;

const source = {
  id: 1,
  code: "DSH-HOT-0001",
  name: "宫保鸡丁",
  intro: "经典川菜",
  categoryId: 1,
  cuisine: "川菜",
  technique: "爆炒",
  taste: "香辣",
  portion: "小碗菜",
  season: "四季",
  meatType: "荤菜",
  price: 18,
  category: { code: "HOT" },
  netDetails: [],
  minorDetails: [],
  seasoningDetails: [],
  sauceDetails: [],
  processes: [],
};

function createRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/dishes/1/copy", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/dishes/[id]/copy", () => {
  beforeEach(() => {
    mockedPrisma.dish.findUnique.mockReset();
    mockedPrisma.dish.findFirst.mockReset();
    mockedPrisma.$transaction.mockReset();
    mockedPrisma.$transaction.mockImplementation(async (callback) =>
      callback({})
    );
    mockedLogOperation.mockReset();
    mockedCostMap.mockReset();
    mockedCreateVariant.mockReset();
  });

  it("菜品不存在时返回 404", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(null);
    const res = await POST(createRequest(), params());
    expect(res.status).toBe(404);
  });

  it("默认名称加「-副本」并按 1 倍复制", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(source);
    mockedPrisma.dish.findFirst.mockResolvedValueOnce(null);
    mockedCostMap.mockResolvedValueOnce(new Map([[1, 12]]));
    mockedCreateVariant.mockResolvedValueOnce({
      id: 2,
      name: "宫保鸡丁-副本",
    });

    const res = await POST(createRequest(), params());
    expect(res.status).toBe(201);
    expect(mockedCreateVariant).toHaveBeenCalledWith(
      {},
      source,
      expect.objectContaining({
        name: "宫保鸡丁-副本",
        portion: "小碗菜",
        factor: 1,
        cost: 12,
        operator: "admin",
      })
    );
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("指定名称重复时返回 409", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(source);
    mockedPrisma.dish.findFirst.mockResolvedValueOnce({ code: "DSH-HOT-0009" });

    const res = await POST(createRequest({ name: "宫保鸡丁-副本" }), params());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("已存在同名同份量");
    expect(mockedCreateVariant).not.toHaveBeenCalled();
  });
});
