import {
  createSelfProductionOrderSchema,
  selfProductionItemInputSchema,
} from "../schemas/self-production-order";
import {
  createProductionPlanSchema,
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

  it("只选内部生产单也可以创建", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      scheduleIds: [],
      selfOrderIds: [1],
    });
    expect(result.success).toBe(true);
  });

  it("排程与内部生产单同时为空时拒绝", () => {
    const result = createProductionPlanSchema.safeParse({
      planDate,
      scheduleIds: [],
      selfOrderIds: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProductionPlanSchema", () => {
  it("selfOrderIds 可省略（表示保留现有来源）", () => {
    const result = updateProductionPlanSchema.safeParse({
      planDate: "2026-11-18",
      scheduleIds: [1],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.selfOrderIds).toBeUndefined();
  });
});
