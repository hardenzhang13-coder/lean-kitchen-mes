import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { PUT } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    ingredient: {
      findFirst: jest.fn(),
    },
    ingredientCategoryL2: {
      findUnique: jest.fn(),
    },
    unit: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  ingredient: { findFirst: jest.Mock };
  ingredientCategoryL2: { findUnique: jest.Mock };
  unit: { findMany: jest.Mock };
  $transaction: jest.Mock;
};
const mockedLogOperation = logOperation as jest.Mock;
const mockedIngredientUpdate = jest.fn();
const mockedNetUpdateMany = jest.fn();

const existing = {
  id: 1,
  code: "ING-0001",
  name: "带皮五花肉",
  alias: null,
  l2Code: "MEA-POR",
  purchaseUnit: "斤",
  stockUnit: "斤",
  unitsPerPurchase: 1,
  purchaseSpec: "散称",
  latestRefPrice: 18.5,
  defaultSupplierId: null,
  season: "四季",
  storage: "常温",
  seasoningType: null,
};

const updated = { ...existing, l2Code: "VEG-ROOT" };

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/ingredients/1", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

function params(id = "1") {
  return { params: Promise.resolve({ id }) };
}

describe("PUT /api/ingredients/[id]", () => {
  beforeEach(() => {
    mockedPrisma.ingredient.findFirst.mockReset();
    mockedPrisma.ingredientCategoryL2.findUnique.mockReset();
    mockedPrisma.unit.findMany.mockReset().mockResolvedValue([]);
    mockedPrisma.$transaction.mockReset().mockImplementation(async (callback) =>
      callback({
        ingredient: { update: mockedIngredientUpdate },
        netIngredient: { updateMany: mockedNetUpdateMany },
      })
    );
    mockedIngredientUpdate.mockReset().mockResolvedValue(updated);
    mockedNetUpdateMany.mockReset().mockResolvedValue({ count: 3 });
    mockedLogOperation.mockReset();
    mockedPrisma.ingredient.findFirst.mockResolvedValue(existing);
    mockedPrisma.ingredientCategoryL2.findUnique.mockResolvedValue({
      code: "VEG-ROOT",
    });
  });

  it("分类变化时同事务级联更新净料/小料分类", async () => {
    const res = await PUT(createRequest({ l2Code: "VEG-ROOT" }), params());
    expect(res.status).toBe(200);
    expect(mockedIngredientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ l2Code: "VEG-ROOT" }),
      })
    );
    expect(mockedNetUpdateMany).toHaveBeenCalledWith({
      where: { sourceIngredientId: 1, deletedAt: null },
      data: { l2Code: "VEG-ROOT" },
    });
    expect(mockedLogOperation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        description: expect.stringContaining("级联更新 3 个净料/小料分类"),
      })
    );
  });

  it("二级分类不存在时拒绝更新", async () => {
    mockedPrisma.ingredientCategoryL2.findUnique.mockResolvedValue(null);
    const res = await PUT(createRequest({ l2Code: "BAD" }), params());
    expect(res.status).toBe(400);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
