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
    supplier: {
      findFirst: jest.fn(),
    },
    portionProfile: {
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
  supplier: { findFirst: jest.Mock };
  portionProfile: { findUnique: jest.Mock };
};
const mockedLogOperation = logOperation as jest.Mock;

const transformSource = {
  id: 7,
  name: "蒸鱼双椒酱",
  pricePerJin: 10,
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
  productType: "单品调料",
  sourceMode: "transform",
  sourceIngredientId: 7,
  packageSpec: 1200,
  portion: "单人份",
  yieldRate: 80,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.portionProfile.findUnique.mockResolvedValue({ isActive: true });
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

describe("POST /api/seasoning-products", () => {
  it("转化口径：来源 kind=seasoning 校验 + 出成率派生单价 + 写库", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(transformSource);
    mockedPrisma.ingredient.findUnique.mockResolvedValue({ pricePerJin: 10 });
    mockedPrisma.seasoningProduct.findFirst.mockResolvedValue({ code: "SP-0007" });
    mockedPrisma.seasoningProduct.create.mockResolvedValue({
      id: 99,
      code: "SP-0008",
      ...transformPayload,
      unitPrice: 12.5,
      l2Code: null,
      brand: null,
      purchaseSpec: null,
      purchaseUnit: null,
      latestRefPrice: null,
      pricePerJin: null,
      defaultSupplierId: null,
      processingFeePerJin: null,
      grossMarginRate: 0,
      storage: "常温",
      sourceIngredient: transformSource,
      defaultSupplier: null,
    });

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.unitPrice).toBe(12.5); // 10 ÷ 0.8
    expect(mockedPrisma.seasoningProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceIngredientId: 7,
          yieldRate: 80,
          pricePerJin: null,
          brand: null,
        }),
      })
    );
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("转化口径：来源调味品缺失时 400", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(null);

    const res = await POST(createRequest(transformPayload));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("来源调味品不存在");
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("转化口径：缺少来源或出成率时 400", async () => {
    const res = await POST(
      createRequest({ ...transformPayload, sourceIngredientId: null })
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("外购口径：手填每斤单价直接落价，来源与出成率置空", async () => {
    const payload = {
      name: "成品叉烧酱",
      productType: "成品酱料",
      sourceMode: "purchase",
      packageSpec: 500,
      portion: "单人份",
      brand: "某牌",
      purchaseSpec: "500g/瓶",
      purchaseUnit: "瓶",
      pricePerJin: 9.6,
      defaultSupplierId: 3,
    };
    mockedPrisma.supplier.findFirst.mockResolvedValue({ id: 3 });
    mockedPrisma.seasoningProduct.findFirst.mockResolvedValue(null);
    mockedPrisma.seasoningProduct.create.mockResolvedValue({
      id: 100,
      code: "SP-0001",
      ...payload,
      unitPrice: 9.6,
      yieldRate: null,
      sourceIngredientId: null,
      latestRefPrice: null,
      processingFeePerJin: null,
      grossMarginRate: 0,
      storage: "常温",
      sourceIngredient: null,
      defaultSupplier: { id: 3, name: "某供应商" },
    });

    const res = await POST(createRequest(payload));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.unitPrice).toBe(9.6);
    expect(mockedPrisma.seasoningProduct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceIngredientId: null,
          yieldRate: null,
          pricePerJin: 9.6,
          brand: "某牌",
        }),
      })
    );
  });

  it("外购口径：缺少每斤单价时 400", async () => {
    const res = await POST(
      createRequest({
        name: "成品叉烧酱",
        productType: "成品酱料",
        sourceMode: "purchase",
        packageSpec: 500,
        portion: "单人份",
      })
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });

  it("缺少份量时 400", async () => {
    const res = await POST(createRequest({ ...transformPayload, portion: undefined }));
    expect(res.status).toBe(400);
    expect(mockedPrisma.seasoningProduct.create).not.toHaveBeenCalled();
  });
});
