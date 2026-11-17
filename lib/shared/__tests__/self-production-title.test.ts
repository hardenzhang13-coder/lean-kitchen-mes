import { buildSelfProductionOrderTitle } from "../self-production-title";

describe("buildSelfProductionOrderTitle", () => {
  it("按「切配中心·周几（月日）内部生产单」生成", () => {
    // 2026-11-18 是星期三
    expect(buildSelfProductionOrderTitle("2026-11-18")).toBe(
      "切配中心·周三（11月18日）内部生产单"
    );
  });

  it("跨月与个位日期不加前导零", () => {
    // 2026-12-01 是星期二
    expect(buildSelfProductionOrderTitle("2026-12-01")).toBe(
      "切配中心·周二（12月1日）内部生产单"
    );
  });
});
