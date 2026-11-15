import {
  formatMoney,
  formatPercent,
  formatUnitValue,
  formatDateTime,
} from "../display-format";

describe("列表展示格式化", () => {
  it("金额按字段单位显示在数值行", () => {
    expect(formatMoney(3.56, "斤")).toBe("¥3.56/斤");
    expect(formatMoney("4.5", "份")).toBe("¥4.50/份");
    expect(formatMoney(18.5)).toBe("¥18.50");
  });

  it("空金额统一弱化为占位符文本", () => {
    expect(formatMoney(null, "斤")).toBe("—");
    expect(formatMoney(undefined, "份")).toBe("—");
  });

  it("毛利率空值默认 0", () => {
    expect(formatPercent(null)).toBe("0%");
    expect(formatPercent(undefined)).toBe("0%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent("40")).toBe("40%");
  });

  it("普通数值单位支持无空格与有空格格式", () => {
    expect(formatUnitValue(500, "g/单位", "—", " ")).toBe("500 g/单位");
    expect(formatUnitValue(3, "份", "—", " ")).toBe("3 份");
  });

  it("建档时间按 年-月-日 时:分 展示", () => {
    const date = new Date(2026, 10, 15, 21, 30, 0);
    expect(formatDateTime(date)).toBe("2026-11-15 21:30");
    expect(formatDateTime(date.toISOString())).toBe("2026-11-15 21:30");
  });

  it("空值与非法时间统一弱化为占位符文本", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("不是时间")).toBe("—");
  });
});
