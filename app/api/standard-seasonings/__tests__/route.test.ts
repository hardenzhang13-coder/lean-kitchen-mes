import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { GET, POST } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    standardSeasoning: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    ingredient: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    ingredientCategoryL2: {
      findMany: jest.fn(),
    },
    dishSeasoningDetail: {
      groupBy: jest.fn(),
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
  standardSeasoning: {
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
  };
  ingredient: { findFirst: jest.Mock; findUnique: jest.Mock };
  ingredientCategoryL2: { findMany: jest.Mock };
  dishSeasoningDetail: { groupBy: jest.Mock };
  portionProfile: { findUnique: jest.Mock };
};
const mockedLogOperation = logOperation as jest.Mock;

const seasoningSource = {
  id: 7,
  name: "蒸鱼双椒酱",
  l2Code: "SEA-SOL",
  pricePerJin: 10,
  alias: "某某牌蒸鱼双椒酱",
  purchaseSpec: "1.2kg/瓶",
};

function createRequest(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost:3000/api/standard-seasonings", {
    method,
    body: JSON.stringify(body),
  });
}

function listRequest(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/standard-seasonings${query}`
  );
}

const validPayload = {
  name: "蒸鱼双椒酱•1200g",
  sourceIngredientId: 7,
  packageSpec: 1200,
  portion: "小碗菜·10份",
  yieldRate: 100,
};

describe("GET /api/standard-seasonings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.standardSeasoning.findMany.mockResolvedValue([]);
    mockedPrisma.standardSeasoning.count.mockResolvedValue(0);
    mockedPrisma.dishSeasoningDetail.groupBy.mockResolvedValue([]);
  });

  it("返回分页结构", async () => {
    const res = await GET(listRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it("搜索只匹配名称字段", async () => {
    await GET(listRequest("?q=双椒"));
    expect(mockedPrisma.standardSeasoning.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: { contains: "双椒" } }),
      })
    );
  });

  it("列表返回派生价格与来源调料摘要", async () => {
    mockedPrisma.standardSeasoning.findMany.mockResolvedValue([
      {
        id: 1,
        name: "蒸鱼双椒酱",
        packageSpec: 1200,
        portion: "小碗菜·10份",
        yieldRate: 100,
        unitPrice: 10,
        processingFeePerJin: null,
        grossMarginRate: 0,
        sourceIngredient: { pricePerJin: 10, purchaseSpec: "1.2kg/瓶" },
      },
    ]);

    const res = await GET(listRequest());
    const body = await res.json();
    expect(body.data[0].standardPackagePrice).toBe(24);
    expect(body.data[0].sourceIngredient.purchaseSpec).toBe("1.2kg/瓶");
    // 调料模块不做关联菜品统计
    expect(body.data[0].dishCount).toBeUndefined();
  });
});

describe("POST /api/standard-seasonings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "SEA-SOL" },
      { code: "SEA-LIQ" },
    ]);
    mockedPrisma.ingredient.findFirst.mockResolvedValue(seasoningSource);
    mockedPrisma.ingredient.findUnique.mockResolvedValue({
      pricePerJin: 10,
    });
    mockedPrisma.standardSeasoning.findFirst.mockResolvedValue({
      code: "SEA-SP-0000",
    });
    // 份量档案：validPayload 的份量标签命中启用行
    mockedPrisma.portionProfile.findUnique.mockResolvedValue({
      isActive: true,
    });
    mockedPrisma.standardSeasoning.create.mockResolvedValue({
      id: 3,
      code: "SEA-SP-0001",
      name: "蒸鱼双椒酱•1200g",
      packageSpec: 1200,
      portion: "小碗菜·10份",
      yieldRate: 100,
      unitPrice: 10,
      processingFeePerJin: null,
      grossMarginRate: 0,
      l2Code: "SEA-SOL",
      sourceIngredient: seasoningSource,
    });
  });

  it("缺少份量时返回可读提示", async () => {
    const res = await POST(createRequest({ ...validPayload, portion: undefined }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("请选择份量");
  });

  it("来源调料不存在时拒绝创建", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue(null);
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("来源调料不存在");
  });

  it("来源调料不属于调味品体系时拒绝创建", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue({
      ...seasoningSource,
      l2Code: "VEG-LEF",
    });
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("不属于调味品体系");
  });

  it("来源调料缺每斤单价时拒绝创建", async () => {
    mockedPrisma.ingredient.findFirst.mockResolvedValue({
      ...seasoningSource,
      pricePerJin: null,
    });
    mockedPrisma.ingredient.findUnique.mockResolvedValue({
      pricePerJin: null,
    });
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("缺少每斤单价");
  });

  it("创建成功：编号、单价派生与分类继承", async () => {
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.code).toBe("SEA-SP-0001");
    // 单价 = 来源调料每斤单价 ÷ (出成率/100)
    expect(body.data.unitPrice).toBe(10);
    expect(body.data.standardPackagePrice).toBe(24);
    expect(mockedPrisma.standardSeasoning.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "SEA-SP-0001",
          l2Code: "SEA-SOL",
          unitPrice: 10,
        }),
      })
    );
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("出成率 80 时单价 = 每斤单价 ÷ 0.8", async () => {
    mockedPrisma.standardSeasoning.create.mockResolvedValue({
      id: 3,
      code: "SEA-SP-0001",
      name: "蒸鱼双椒酱•1200g",
      packageSpec: 1200,
      portion: "小碗菜·10份",
      yieldRate: 80,
      unitPrice: 12.5,
      processingFeePerJin: null,
      grossMarginRate: 0,
      l2Code: "SEA-SOL",
      sourceIngredient: seasoningSource,
    });
    const res = await POST(createRequest({ ...validPayload, yieldRate: 80 }));
    const body = await res.json();
    expect(body.data.unitPrice).toBe(12.5);
  });
});
