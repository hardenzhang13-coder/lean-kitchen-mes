import type { Prisma } from "@prisma/client";

import {
  DishScaleValidationError,
  buildDishScalePlan,
  resolveScaleSpecInputs,
  type DishScaleSource,
} from "../dish-scale-plan";

const netIngredient = {
  id: 101,
  code: "PRD-0101",
  name: "鸡丁•100g",
  sourceIngredientId: 11,
  sourceIngredient: { id: 11, name: "鸡肉", pricePerJin: 20 },
  portion: "单人份",
  packageSpec: 100,
  packageMaterial: "密封袋",
  packageSize: "50cm×40cm",
  storage: "冷藏",
  yieldRate: 65,
  processingFeePerJin: 2,
  grossMarginRate: 30,
  l2Code: "MEA-CHK",
};

// 份量档案（倍率新口径：转化倍率 = 目标 multiplier ÷ 源 multiplier）
const portionProfiles = [
  { portion: "单人份", scenario: "单人份", multiplier: 1, isBase: true, isActive: true, sortOrder: 0 },
  { portion: "社区·3份", scenario: "社区", multiplier: 3, isBase: false, isActive: true, sortOrder: 1 },
];

function makeSource(
  overrides: Partial<DishScaleSource> = {}
): DishScaleSource {
  return {
    id: 1,
    name: "宫保鸡丁",
    portion: "单人份",
    categoryId: 1,
    category: { code: "HOT" },
    netDetails: [
      {
        netIngId: 101,
        role: "main",
        amountG: 100,
        netIngredient,
      },
    ],
    minorDetails: [
      {
        netIngId: 102,
        amountG: 20,
        netIngredient: {
          ...netIngredient,
          id: 102,
          code: "PRD-0102",
          name: "葱花",
          packageSpec: 20,
          l2Code: "MIN-VEG",
        },
      },
    ],
    seasoningDetails: [],
    sauceDetails: [],
    processes: [],
    ...overrides,
  } as unknown as DishScaleSource;
}

function makeDb(existingIds: Array<number | null>) {
  const queue = [...existingIds];
  return {
    portionProfile: {
      findMany: jest.fn().mockResolvedValue(portionProfiles),
    },
    netIngredient: {
      findFirst: jest.fn().mockImplementation(async () => {
        const id = queue.shift();
        return id == null
          ? null
          : {
              id,
              code: `PRD-0${id}`,
              name: "已存在规格",
              packageSpec: 300,
              portion: "社区·3份",
            };
      }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("菜品转化计划", () => {
  it("按目标份量匹配已存在规格并生成缺失规格提案", async () => {
    const db = makeDb([201, null]);
    const plan = await buildDishScalePlan(db, makeSource(), "社区·3份");

    expect(plan.factor).toBe(3);
    expect(plan.net).toHaveLength(1);
    expect(plan.net[0].status).toBe("existing");
    expect(plan.net[0].existing?.id).toBe(201);
    expect(plan.net[0].proposal.name).toBe("鸡丁•300g");

    expect(plan.minor).toHaveLength(1);
    expect(plan.minor[0].status).toBe("missing");
    expect(plan.minor[0].proposal.packageSpec).toBe(60);
    expect(plan.minor[0].proposal.yieldRate).toBe(65);
    expect(plan.minor[0].canCreate).toBe(true);
  });

  it("缺少来源原料时标记为不可自动创建", async () => {
    const source = makeSource({
      netDetails: [
        {
          netIngId: 103,
          role: "main",
          amountG: 100,
          netIngredient: {
            ...netIngredient,
            sourceIngredientId: null,
            sourceIngredient: null,
          },
        },
      ],
      minorDetails: [],
    } as unknown as Partial<DishScaleSource>);

    const db = makeDb([null]);
    const plan = await buildDishScalePlan(db, source, "社区·3份");
    expect(plan.net[0].canCreate).toBe(false);
  });

  it("同一净料被重复引用时只生成一条规格计划", async () => {
    const source = makeSource({
      netDetails: [
        {
          netIngId: 101,
          role: "main",
          amountG: 100,
          netIngredient,
        },
        {
          netIngId: 101,
          role: "support",
          amountG: 50,
          netIngredient,
        },
      ],
      minorDetails: [],
    } as unknown as Partial<DishScaleSource>);

    const db = makeDb([null]);
    const plan = await buildDishScalePlan(db, source, "社区·3份");
    expect(plan.net).toHaveLength(1);
  });

  it("用户编辑覆盖默认提案，并校验规格合法性", async () => {
    const db = makeDb([null, null]);
    const plan = await buildDishScalePlan(db, makeSource(), "社区·3份");

    const inputs = resolveScaleSpecInputs(plan, [
      {
        kind: "net",
        sourceNetIngId: 101,
        name: "鸡丁（大份）",
        packageSpec: 800,
        yieldRate: 60,
        processingFeePerJin: null,
        grossMarginRate: null,
      },
    ]);

    expect(inputs.get("net:101")).toMatchObject({
      name: "鸡丁（大份）",
      packageSpec: 800,
      yieldRate: 60,
    });
    expect(inputs.get("minor:102")?.packageSpec).toBe(60);

    expect(() =>
      resolveScaleSpecInputs(plan, [
        {
          kind: "net",
          sourceNetIngId: 101,
          name: "鸡丁",
          packageSpec: 0,
          yieldRate: 60,
          processingFeePerJin: null,
          grossMarginRate: null,
        },
      ])
    ).toThrow(DishScaleValidationError);
  });
});
