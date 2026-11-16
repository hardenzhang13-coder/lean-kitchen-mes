import { NextRequest } from "next/server";

import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { getCurrentDishCostMap } from "@/lib/server/dish-costing";
import { createDishVariant } from "@/lib/server/dish-variant";
import {
  DishScaleValidationError,
  buildDishScalePlan,
  generateNetIngredientCode,
  resolveScaleSpecInputs,
} from "@/lib/server/dish-scale-plan";
import type { DishScaleSpecInput } from "@/lib/shared/dish-scale";
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

jest.mock("@/lib/server/dish-scale-plan", () => {
  const actual = jest.requireActual("@/lib/server/dish-scale-plan");
  return {
    ...actual,
    buildDishScalePlan: jest.fn(),
    resolveScaleSpecInputs: jest.fn(),
    generateNetIngredientCode: jest.fn(),
  };
});

const mockedPrisma = prisma as unknown as {
  dish: { findUnique: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};
const mockedLogOperation = logOperation as jest.Mock;
const mockedCostMap = getCurrentDishCostMap as jest.Mock;
const mockedCreateVariant = createDishVariant as jest.Mock;
const mockedBuildPlan = buildDishScalePlan as jest.Mock;
const mockedResolveInputs = resolveScaleSpecInputs as jest.Mock;
const mockedGenerateCode = generateNetIngredientCode as jest.Mock;
const mockedNetCreate = jest.fn();

const source = {
  id: 1,
  code: "DSH-HOT-0001",
  name: "宫保鸡丁",
  portion: "小碗菜",
  categoryId: 1,
  category: { code: "HOT" },
  netDetails: [],
  minorDetails: [],
  seasoningDetails: [],
  sauceDetails: [],
  processes: [],
};

const missingPlan = {
  factor: 6,
  targetPortion: "社区·3份",
  net: [
    {
      kind: "net",
      sourceNetIngId: 101,
      sourceName: "鸡丁",
      sourceCode: "PRD-0101",
      sourcePortion: "小碗菜",
      sourcePackageSpec: 100,
      l2Code: "MEA-CHK",
      sourceIngredientId: 11,
      sourceIngredientName: "鸡肉",
      sourceIngredientPricePerJin: 20,
      packageMaterial: "密封袋",
      packageSize: "50cm×40cm",
      storage: "冷藏",
      canCreate: true,
      status: "missing",
      proposal: {
        name: "鸡丁",
        packageSpec: 600,
        yieldRate: 65,
        processingFeePerJin: 2,
        grossMarginRate: 30,
        portion: "社区·3份",
      },
    },
  ],
  minor: [],
};

function createRequest(body: unknown = { portion: "社区·3份" }): NextRequest {
  return new NextRequest("http://localhost:3000/api/dishes/1/scale", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function params(id = "1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/dishes/[id]/scale", () => {
  beforeEach(() => {
    mockedPrisma.dish.findUnique.mockReset();
    mockedPrisma.dish.findFirst.mockReset();
    mockedPrisma.$transaction.mockReset();
    mockedPrisma.$transaction.mockImplementation(async (callback) =>
      callback({ netIngredient: { create: mockedNetCreate } })
    );
    mockedNetCreate.mockReset();
    mockedNetCreate.mockResolvedValue({ id: 999 });
    mockedLogOperation.mockReset();
    mockedCostMap.mockReset();
    mockedCreateVariant.mockReset();
    mockedBuildPlan.mockReset();
    mockedResolveInputs.mockReset();
    mockedGenerateCode.mockReset();
  });

  it("缺失规格自动建档，并把 BOM 指向新规格", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(source);
    mockedPrisma.dish.findFirst.mockResolvedValueOnce(null);
    mockedCostMap.mockResolvedValueOnce(new Map([[1, 12]]));
    mockedBuildPlan.mockResolvedValueOnce(missingPlan);
    mockedResolveInputs.mockReturnValueOnce(
      new Map([
        [
          "net:101",
          {
            kind: "net",
            sourceNetIngId: 101,
            name: "鸡丁（大份）",
            packageSpec: 800,
            yieldRate: 60,
            processingFeePerJin: null,
            grossMarginRate: null,
          },
        ],
      ])
    );
    mockedGenerateCode.mockResolvedValueOnce("PRD-0200");
    mockedCreateVariant.mockResolvedValueOnce({
      id: 2,
      code: "DSH-HOT-0002",
    });

    const res = await POST(createRequest(), params());
    expect(res.status).toBe(201);

    const netMap = mockedCreateVariant.mock.calls[0][2].netIngIdMap as Map<
      number,
      number
    >;
    expect(netMap.get(101)).toBe(999);
    expect(mockedNetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "鸡丁（大份）",
          packageSpec: 800,
          yieldRate: 60,
          portion: "社区·3份",
          l2Code: "MEA-CHK",
          unitPrice: 33.33,
        }),
      })
    );

    const createArg = mockedCreateVariant.mock.calls[0][2];
    expect(createArg).toMatchObject({
      name: "宫保鸡丁",
      portion: "社区·3份",
      factor: 6,
    });
    expect(mockedLogOperation).toHaveBeenCalled();
  });

  it("同一净料同时出现在主料与小料时只创建一次目标规格", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(source);
    mockedPrisma.dish.findFirst.mockResolvedValueOnce(null);
    mockedCostMap.mockResolvedValueOnce(new Map([[1, 12]]));
    mockedBuildPlan.mockResolvedValueOnce({
      ...missingPlan,
      minor: [{ ...missingPlan.net[0], kind: "minor" }],
    });
    const input = {
      kind: "net" as const,
      sourceNetIngId: 101,
      name: "鸡丁",
      packageSpec: 600,
      yieldRate: 65,
      processingFeePerJin: 2,
      grossMarginRate: 30,
    };
    mockedResolveInputs.mockReturnValueOnce(
      new Map<string, DishScaleSpecInput>([
        ["net:101", input],
        ["minor:101", { ...input, kind: "minor" }],
      ])
    );
    mockedGenerateCode.mockResolvedValueOnce("PRD-0200");
    mockedCreateVariant.mockResolvedValueOnce({ id: 2 });

    const res = await POST(createRequest(), params());
    expect(res.status).toBe(201);
    expect(mockedNetCreate).toHaveBeenCalledTimes(1);

    const options = mockedCreateVariant.mock.calls[0][2];
    expect(options.netIngIdMap.get(101)).toBe(999);
    expect(options.minorIngIdMap.get(101)).toBe(999);
  });

  it("执行阶段的规格校验失败返回 400", async () => {
    mockedPrisma.dish.findUnique.mockResolvedValueOnce(source);
    mockedPrisma.dish.findFirst.mockResolvedValueOnce(null);
    mockedCostMap.mockResolvedValueOnce(new Map([[1, 12]]));
    mockedBuildPlan.mockResolvedValueOnce(missingPlan);
    mockedResolveInputs.mockImplementationOnce(() => {
      throw new DishScaleValidationError("封装规格必须为正整数");
    });

    const res = await POST(createRequest(), params());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("封装规格必须为正整数");
    expect(mockedCreateVariant).not.toHaveBeenCalled();
  });
});
