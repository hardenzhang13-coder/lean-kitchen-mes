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

type Candidate = {
  id: number;
  code: string;
  name: string;
  packageSpec: number;
  portion: string;
};

function candidate(id: number, name: string, packageSpec: number): Candidate {
  return { id, code: `PRD-0${id}`, name, packageSpec, portion: "社区·3份" };
}

/**
 * 模拟 netIngredient.findMany：按 where.packageSpec 过滤候选池，
 * 与真实查询的「目标份量 + 规格 = 期望值」过滤一致（切法由 JS 侧再过滤）。
 */
function makeDb(pool: Candidate[]) {
  return {
    portionProfile: {
      findMany: jest.fn().mockResolvedValue(portionProfiles),
    },
    netIngredient: {
      findMany: jest
        .fn()
        .mockImplementation(async (args: { where?: { packageSpec?: number } }) => {
          const expected = args?.where?.packageSpec;
          return pool.filter((row) => row.packageSpec === expected);
        }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("菜品转化计划", () => {
  it("同切法且规格=源×倍率的已存在规格直接复用，其余生成缺失提案", async () => {
    const db = makeDb([candidate(201, "鸡丁•300g", 300)]);
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

  it("同来源原料但切法不同的规格不复用（回归：静默错配切法）", async () => {
    const db = makeDb([candidate(202, "鸡丝•300g", 300)]);
    const plan = await buildDishScalePlan(db, makeSource(), "社区·3份");

    expect(plan.net[0].status).toBe("missing");
    expect(plan.net[0].existing).toBeUndefined();
    expect(plan.net[0].proposal.name).toBe("鸡丁•300g");
    expect(plan.net[0].proposal.packageSpec).toBe(300);
  });

  it("同切法但规格不等于源×倍率时不复用（回归：静默错配规格）", async () => {
    // 候选池里只有 500g（DB 层按期望 300g 过滤后为空）
    const db = makeDb([candidate(203, "鸡丁•500g", 500)]);
    const plan = await buildDishScalePlan(db, makeSource(), "社区·3份");

    expect(plan.net[0].status).toBe("missing");
    expect(plan.net[0].proposal.packageSpec).toBe(300);
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

    const db = makeDb([]);
    const plan = await buildDishScalePlan(db, source, "社区·3份");
    expect(plan.net[0].canCreate).toBe(false);
  });

  it("缺少来源原料但库中已有同切法同规格时可复用", async () => {
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

    const db = makeDb([candidate(204, "鸡丁•300g", 300)]);
    const plan = await buildDishScalePlan(db, source, "社区·3份");
    expect(plan.net[0].status).toBe("existing");
    expect(plan.net[0].existing?.id).toBe(204);
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

    const db = makeDb([]);
    const plan = await buildDishScalePlan(db, source, "社区·3份");
    expect(plan.net).toHaveLength(1);
  });

  it("用户编辑覆盖默认提案，并校验规格合法性", async () => {
    const db = makeDb([]);
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
