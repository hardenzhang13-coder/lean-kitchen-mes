import { createOutboundSchema } from "@/lib/server/schemas/prepped-stock";

describe("createOutboundSchema", () => {
  it("允许生产批次拆店出库", () => {
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      storeId: 2,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 2 }],
    });

    expect(result.success).toBe(true);
  });

  it("允许排程单出库并要求收货门店一致由路由校验", () => {
    const result = createOutboundSchema.safeParse({
      scheduleId: 1,
      storeId: 2,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(true);
  });

  it("拒绝同时指定排程单和生产批次", () => {
    const result = createOutboundSchema.safeParse({
      scheduleId: 1,
      productionPlanId: 2,
      storeId: 3,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "排程单出库与生产批次出库二选一"
      );
    }
  });

  it("拒绝未指定排程单或生产批次", () => {
    const result = createOutboundSchema.safeParse({
      storeId: 1,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "排程单出库与生产批次出库二选一"
      );
    }
  });

  it("拒绝未指定收货门店", () => {
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("storeId"))).toBe(
        true
      );
    }
  });

  it("接受业务出库时间并转换为 Date", () => {
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      storeId: 2,
      outboundAt: "2026-11-01T08:30:00.000Z",
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outboundAt?.toISOString()).toBe(
        "2026-11-01T08:30:00.000Z"
      );
    }
  });

  it("接受未来出库时间（不对出库时间做限制）", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      storeId: 2,
      outboundAt: future,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outboundAt?.toISOString()).toBe(future);
    }
  });

  it("拒绝本次出库总数为 0 的空出库单", () => {
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      storeId: 2,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 0 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("本次出库总数必须大于 0");
    }
  });

  it("允许部分行出库且总数大于 0", () => {
    const result = createOutboundSchema.safeParse({
      productionPlanId: 1,
      storeId: 2,
      items: [
        { sourceType: "net", sourceId: 1, shippedPortions: 0 },
        { sourceType: "net", sourceId: 2, shippedPortions: 0.5 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("拒绝内部生产单来源（切配中心出库已下线）", () => {
    const result = createOutboundSchema.safeParse({
      selfOrderId: 3,
      storeId: 2,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "切配中心来源出库已下线：内部生产单已并入生产计划单流程，新出库单请按门店排程单创建"
      );
    }
  });
});
