import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { GET, POST } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    seasoningProduct: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    ingredient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/server/api-auth", () => ({
  logOperation: jest.fn(),
}));

jest.mock("@/lib/server/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockedPrisma = prisma as unknown as {
  seasoningProduct: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
  };
  ingredient: { findFirst: jest.Mock; findUnique: jest.Mock };
};
const mockedLogOperation = logOperation as jest.Mock;

const transformSource = {
  id: 7,
  name: "蒸鱼双椒酱",
  seasoningType: "单品调料",
};

function createRequest(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost:3000/api/seasoning-products", {
    method,
    body: JSON.stringify(body),
  });
}

function listRequest(query = ""): NextRequest {
  return new NextRequest(`http://localhost:3000/api/seasoning-products${query}`);
}

const transformPayload = {
  name: "蒸鱼双椒酱•1200g",
  sourceIngredientId: 7,
  packageSpec: 1200,
  yieldRate: 80,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/seasoning-products", () => {
  it("按 productType 过滤并分页返回", async () => {
    mockedPrisma.seasoningProduct.findMany.mockResolvedValue([]);
    mockedPrisma.seasoningProduct.count.mockResolvedValue(0);

    const res = await GET(listRequest("?productType=复合调料&page=1&pageSize=20"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]);
    expect(mockedPrisma.seasoningProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productType: "复合调料", deletedAt: null }),
      })
    );
  });

  it("缺省不带过滤时返回全部产物", async () => {
    mockedPrisma.seasoningProduct.findMany.mockResolvedValue([]);
    mockedPrisma.seasoningProduct.count.mockResolvedValue(0);

    await GET(listRequest());

    expect(mockedPrisma.seasoningProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });
});

describe("POST /api/seasoning-products（纯转化口径）", () => {
  it("来源校验 + 类型继承来源 + 出成率派生单价 + 写库", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(transformSource);
    mockedPrisma.ingredient.findUnique.mockResolvedValue({ pricePerJin: 10 });
    mockedPrisma.seasoningProduct.findFirst.mockResolvedValue({ code: "SP-0007" });
    mockedPrisma.seasoningProduct.create.mockResolvedValue({
      id: 99,
      code: "SP-0008",
      name: transformPayload.name,
      productType: "单品调料",
      sourceIngredientId: 7,
      yieldRate: 80,
      packageSpec: 1200,
      unitPrice: 12.5,
      processingFeePerJin: null,
      grossMarginRate: 0,
      storage: "常温",
      sourceIngredient: { ...transformSource, pricePerJin: 10 },
    });

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.unitPrice).toBe(12.5); // 10 ÷ 0.8
    expect(mockedPrisma.seasoningProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productType: "单品调料",
          sourceIngredientId: 7,
          yieldRate: 80,
          packageSpec: 1200,
        }),
      })
    );
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("来源调味品缺失时 400", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(null);

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("来源调味品不存在");
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("来源调味品未设置类型时 400，提示先补类型", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue({
      id: 7,
      name: "蒸鱼双椒酱",
      seasoningType: null,
    });

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("未设置类型");
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("缺少来源或出成率时 400", async () => {
    const res = await POST(
      createRequest({ ...transformPayload, sourceIngredientId: null })
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("来源缺每斤单价时 400，无法派生单价", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(transformSource);
    mockedPrisma.ingredient.findUnique.mockResolvedValue({ pricePerJin: null });

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("每斤单价");
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });
});
