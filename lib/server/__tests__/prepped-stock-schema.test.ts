import { createOutboundSchema } from "@/lib/server/schemas/prepped-stock";

describe("createOutboundSchema", () => {
  it("拒绝本次出库总数为 0 的空出库单", () => {
    const result = createOutboundSchema.safeParse({
      scheduleId: 1,
      items: [
        { sourceType: "net", sourceId: 1, shippedPortions: 0 },
        { sourceType: "minor", sourceId: 2, shippedPortions: 0 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("本次出库总数必须大于 0");
    }
  });

  it("允许部分行出库且总数大于 0", () => {
    const result = createOutboundSchema.safeParse({
      scheduleId: 1,
      items: [
        { sourceType: "net", sourceId: 1, shippedPortions: 0 },
        { sourceType: "minor", sourceId: 2, shippedPortions: 0.5 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("拒绝内部生产单来源（切配中心出库已下线）", () => {
    const result = createOutboundSchema.safeParse({
      selfOrderId: 3,
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "切配中心来源出库已下线：内部生产单已并入生产计划单流程，新出库单请按门店排程单创建"
      );
    }
  });

  it("拒绝未指定任何来源单据", () => {
    const result = createOutboundSchema.safeParse({
      items: [{ sourceType: "net", sourceId: 1, shippedPortions: 1 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("请选择排程单");
    }
  });

  it("拒绝同时指定排程单与内部生产单", () => {
    const result = createOutboundSchema.safeParse({
      scheduleId: 1,
      selfOrderId: 3,
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
