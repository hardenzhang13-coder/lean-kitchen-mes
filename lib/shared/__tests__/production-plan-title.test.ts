import { buildProductionPlanTitle } from "../production-plan-title";

describe("buildProductionPlanTitle", () => {
  it("按「切配中心·周几（月日）生产计划」生成", () => {
    // 2026-11-21 是星期六
    expect(buildProductionPlanTitle("2026-11-21")).toBe(
      "切配中心·周六（11月21日）生产计划"
    );
  });

  it("跨月与个位日期不加前导零", () => {
    // 2026-12-01 是星期二
    expect(buildProductionPlanTitle("2026-12-01")).toBe(
      "切配中心·周二（12月1日）生产计划"
    );
  });
});
