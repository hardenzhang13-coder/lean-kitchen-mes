import type { Prisma } from "@prisma/client";
import { getOutboundLines, getSelfOrderOutboundLines } from "../outbound-utils";

interface MockOptions {
  selfOrder?: unknown;
  cuttingOrders?: unknown[];
  nets?: unknown[];
  stock?: unknown[];
  l2?: unknown[];
  l1?: unknown[];
}

function createTx(options: MockOptions) {
  return {
    selfProductionOrder: {
      findUnique: jest.fn().mockResolvedValue(options.selfOrder ?? null),
    },
    cuttingOrder: { findMany: jest.fn().mockResolvedValue(options.cuttingOrders ?? []) },
    netIngredient: { findMany: jest.fn().mockResolvedValue(options.nets ?? []) },
    preppedStock: { findMany: jest.fn().mockResolvedValue(options.stock ?? []) },
    ingredientCategoryL2: { findMany: jest.fn().mockResolvedValue(options.l2 ?? []) },
    ingredientCategoryL1: { findMany: jest.fn().mockResolvedValue(options.l1 ?? []) },
  } as unknown as Prisma.TransactionClient;
}

const net = {
  id: 100,
  code: "NET-100",
  name: "土豆丝",
  unitPrice: 0,
  yieldRate: 80,
  processingFeePerJin: 1,
  grossMarginRate: 20,
  packageSpec: 500,
  l2Code: "VEG-LEF",
  sourceIngredient: { pricePerJin: 10 },
};

const categories = {
  l2: [{ code: "VEG-LEF", name: "叶菜类", parentCode: "VEG" }],
  l1: [{ code: "VEG", name: "蔬菜" }, { code: "MIN", name: "小料" }],
};

describe("getSelfOrderOutboundLines", () => {
  it("已完成内部生产单按明细份数生成出库行，并带出库存与出库价", async () => {
    const tx = createTx({
      selfOrder: {
        id: 9,
        code: "SPO-20261118-001",
        title: "切配中心内部生产单",
        produceDate: new Date("2026-11-18"),
        status: "已完成",
        items: [{ id: 1, sourceType: "net", sourceId: 100, portions: 5 }],
      },
      nets: [net],
      stock: [{ sourceType: "net", sourceId: 100, currentPortions: 10 }],
      ...categories,
    });

    const [line] = await getSelfOrderOutboundLines(tx, 9);

    expect(line).toMatchObject({
      key: "net:100",
      itemCode: "NET-100",
      itemName: "土豆丝",
      l1Name: "蔬菜",
      l2Name: "叶菜类",
      packageSpec: 500,
      requiredPortions: 5,
      requiredQty: 2500,
      availablePortions: 10,
      prepStatus: "normal",
      suggestedPortions: 5,
    });
    expect(line.pricePerJin).toBeGreaterThan(0);
  });

  it("进行中的内部生产单视为未切配，默认不出库", async () => {
    const tx = createTx({
      selfOrder: {
        id: 9,
        status: "进行中",
        items: [{ id: 1, sourceType: "net", sourceId: 100, portions: 5 }],
      },
      nets: [net],
      stock: [{ sourceType: "net", sourceId: 100, currentPortions: 10 }],
      ...categories,
    });

    const [line] = await getSelfOrderOutboundLines(tx, 9);

    expect(line.prepStatus).toBe("unfinished");
    expect(line.suggestedPortions).toBe(0);
  });

  it("已完成但库存不足时标记量不足，建议出库取库存份数", async () => {
    const tx = createTx({
      selfOrder: {
        id: 9,
        status: "已完成",
        items: [{ id: 1, sourceType: "minor", sourceId: 100, portions: 5 }],
      },
      nets: [net],
      stock: [{ sourceType: "minor", sourceId: 100, currentPortions: 2 }],
      ...categories,
    });

    const [line] = await getSelfOrderOutboundLines(tx, 9);

    expect(line.prepStatus).toBe("insufficient");
    expect(line.availablePortions).toBe(2);
    expect(line.suggestedPortions).toBe(2);
  });

  it("净料缺少封装规格时抛错", async () => {
    const tx = createTx({
      selfOrder: {
        id: 9,
        status: "已完成",
        items: [{ id: 1, sourceType: "net", sourceId: 100, portions: 5 }],
      },
      nets: [{ ...net, packageSpec: null }],
      stock: [],
      ...categories,
    });

    await expect(getSelfOrderOutboundLines(tx, 9)).rejects.toThrow("缺少封装规格");
  });
});

describe("getOutboundLines（门店排程）", () => {
  it("切配工单未完成时标记未切配", async () => {
    const tx = createTx({
      cuttingOrders: [
        {
          sourceType: "net",
          sourceId: 100,
          sourceCode: "NET-100",
          itemName: "土豆丝",
          l2Code: "VEG-LEF",
          packageSpec: 500,
          requiredQty: 2500,
          status: "pending",
        },
      ],
      nets: [net],
      stock: [{ sourceType: "net", sourceId: 100, currentPortions: 10 }],
      ...categories,
    });

    const [line] = await getOutboundLines(tx, 1);

    expect(line.requiredPortions).toBe(5);
    expect(line.prepStatus).toBe("unfinished");
    expect(line.suggestedPortions).toBe(0);
  });
});
