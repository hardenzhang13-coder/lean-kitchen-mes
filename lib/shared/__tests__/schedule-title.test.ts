import { buildScheduleTitle } from "../schedule-title";

describe("buildScheduleTitle", () => {
  it("按「门店 · 周几（月日）·菜单」生成", () => {
    // 2026-11-21 是星期六
    expect(buildScheduleTitle("天府店", "2026-11-21")).toBe(
      "天府店 · 周六（11月21日）·菜单"
    );
  });

  it("跨月与个位日期不加前导零", () => {
    // 2026-12-01 是星期二
    expect(buildScheduleTitle("高新店", "2026-12-01")).toBe(
      "高新店 · 周二（12月1日）·菜单"
    );
  });
});
