import {
  createSelfProductionOrderSchema,
  selfProductionItemInputSchema,
} from "../schemas/self-production-order";
import {
  createProductionPlanSchema,
  productionPlanPreviewQuerySchema,
  updateProductionPlanSchema,
} from "../schemas/production-plan";

describe("selfProductionItemInputSchema", () => {
  it("份数最多 2 位小数", () => {
    expect(selfProductionItemInputSchema.safeParse({ sourceId: 1, portions: 1.25 }).success).toBe(
      true
    );
    expect(selfProductionItemInputSchema.safeParse({ sourceId: 1, portions: 1.234 }).success).toBe(
      false
    );
  });
});

describe("createSelfProductionOrderSchema", () => {
  it("同一净料重复出现时拒绝", () => {
    const result = createSelfProductionOrderSchema.safeParse({
      produceDate: "2026-11-18",
      items: [
        { sourceId: 1, portions: 2 },
        { sourceId: 1, portions: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("空明细拒绝", () => {
    const result = createSelfProductionOrderSchema.safeParse({
      produceDate: "2026-11-18",
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("createProductionPlanSchema", () => {
  const planDate = "2026-11-18";

  it("只选排程单 + 备注即可创建", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "备注",
      scheduleIds: [1],
    });
    expect(result.success).toBe(true);
  });

  it("备注必填：缺 remark 拒绝", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      scheduleIds: [1],
    });
    expect(result.success).toBe(false);
  });

  it("备注为空字符串时拒绝并给出提示", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "   ",
      scheduleIds: [1],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "请填写备注")).toBe(true);
    }
  });

  it("排程为空且无正份数调整时拒绝（禁止空计划单）", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "备注",
      scheduleIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("排程为空但手工行份数大于 0 时通过（纯手工切配计划）", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "备注",
      scheduleIds: [],
      adjustments: [{ sourceId: 100, portions: 3 }],
    });
    expect(result.success).toBe(true);
  });

  it("排程为空且调整行全为 0 时拒绝", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "备注",
      scheduleIds: [],
      adjustments: [{ sourceId: 100, portions: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("remark 与 adjustments 合法时通过", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      remark: "备注",
      scheduleIds: [1, 2],
      adjustments: [
        { sourceId: 100, portions: 3 },
        { sourceId: 101, portions: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("同一净料重复调整时拒绝", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      scheduleIds: [1],
      adjustments: [
        { sourceId: 100, portions: 3 },
        { sourceId: 100, portions: 4 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("份数为负或超上限时拒绝", () => {
    const base = { planDate, scheduleIds: [1] };
    expect(
      createProductionPlanSchema.safeParse({
        ...base,
        adjustments: [{ sourceId: 100, portions: -1 }],
      }).success
    ).toBe(false);
    expect(
      createProductionPlanSchema.safeParse({
        ...base,
        adjustments: [{ sourceId: 100, portions: 100001 }],
      }).success
    ).toBe(false);
  });
});

describe("updateProductionPlanSchema", () => {
  it("与新建同构：scheduleIds 必填，adjustments 可省略", () => {
    const result = updateProductionPlanSchema.safeParse({
      planDate: "2026-11-18",
      remark: "备注",
      scheduleIds: [1],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.adjustments).toBeUndefined();
  });
});

describe("productionPlanPreviewQuerySchema", () => {
  it("空字符串解析为空数组（纯手工切配计划预览）", () => {
    const result = productionPlanPreviewQuerySchema.safeParse({ scheduleIds: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scheduleIds).toEqual([]);
  });

  it("逗号分隔解析为数字数组", () => {
    const result = productionPlanPreviewQuerySchema.safeParse({ scheduleIds: "1,2,3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.scheduleIds).toEqual([1, 2, 3]);
  });

  it("非法格式拒绝", () => {
    expect(
      productionPlanPreviewQuerySchema.safeParse({ scheduleIds: "1,a,3" }).success
    ).toBe(false);
    expect(
      productionPlanPreviewQuerySchema.safeParse({ scheduleIds: "1,,3" }).success
    ).toBe(false);
  });
});
