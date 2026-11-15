import {
  SCHEDULE_STATUS_OPTIONS,
  SCHEDULE_STATUS_VALUES,
  getScheduleStatusOption,
  isValidScheduleStatus,
  scheduleStatusToVariant,
} from "../schedule-status";

describe("schedule status enum", () => {
  it("枚举值与选项元数据一一对应", () => {
    expect(SCHEDULE_STATUS_OPTIONS).toHaveLength(SCHEDULE_STATUS_VALUES.length);
    expect(SCHEDULE_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...SCHEDULE_STATUS_VALUES,
    ]);
  });

  it("取值解析只返回已登记状态", () => {
    expect(getScheduleStatusOption("进行中")?.variant).toBe("info");
    expect(getScheduleStatusOption("已作废")).toBeNull();
    expect(getScheduleStatusOption(null)).toBeNull();
  });

  it("合法性判断拒绝历史或其他单据状态", () => {
    expect(isValidScheduleStatus("待生效")).toBe(true);
    expect(isValidScheduleStatus("已完成")).toBe(true);
    expect(isValidScheduleStatus("已作废")).toBe(false);
    expect(isValidScheduleStatus(undefined)).toBe(false);
  });

  it("未知状态落到中性色，不冒用状态语义", () => {
    expect(scheduleStatusToVariant("已完成")).toBe("success");
    expect(scheduleStatusToVariant("已作废")).toBe("neutral");
  });
});
