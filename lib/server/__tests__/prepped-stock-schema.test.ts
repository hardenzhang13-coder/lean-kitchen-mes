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
});
