import {
  formatPortionsValue,
  getOutboundDisplayStatus,
  OUTBOUND_STATUS_LABEL,
} from "@/lib/shared/prepped-stock";

describe("prepped stock outbound helpers", () => {
  it("按计划数和本次出库数计算三种出库状态", () => {
    expect(getOutboundDisplayStatus(5, 0)).toBe("unshipped");
    expect(getOutboundDisplayStatus(5, 2.5)).toBe("partial");
    expect(getOutboundDisplayStatus(5, 5)).toBe("shipped");
    expect(OUTBOUND_STATUS_LABEL).toEqual({
      unshipped: "未出库",
      partial: "部分出库",
      shipped: "已出库",
    });
  });

  it("份数格式化为不带单位的打印值", () => {
    expect(formatPortionsValue(5)).toBe("5");
    expect(formatPortionsValue(2.54)).toBe("2.5");
    expect(formatPortionsValue(0)).toBe("0");
  });
});
