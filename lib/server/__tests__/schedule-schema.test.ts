import {
  createScheduleSchema,
  scheduleQuerySchema,
} from "../schemas/schedule";

const base = {
  title: "周一午餐",
  scheduleDate: "2026-11-17",
  storeId: 1,
};

describe("createScheduleSchema", () => {
  it("接受合法输入", () => {
    const result = createScheduleSchema.safeParse({
      ...base,
      items: [
        { dishId: 1, quantity: 2 },
        { dishId: 2, quantity: 3 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("拒绝重复菜品行（重复会让切配/采购只按第一行计算）", () => {
    const result = createScheduleSchema.safeParse({
      ...base,
      items: [
        { dishId: 1, quantity: 2 },
        { dishId: 1, quantity: 3 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("门店必填，不再静默兜底为 1", () => {
    const result = createScheduleSchema.safeParse({
      title: base.title,
      scheduleDate: base.scheduleDate,
      items: [{ dishId: 1, quantity: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("scheduleQuerySchema", () => {
  it("状态筛选只接受三态", () => {
    expect(scheduleQuerySchema.safeParse({ status: "已完成" }).success).toBe(true);
    expect(scheduleQuerySchema.safeParse({ status: "已作废" }).success).toBe(false);
  });
});
