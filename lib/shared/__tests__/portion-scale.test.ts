import {
  getPortionOption,
  parsePortionCount,
  portionScaleFactor,
  toPortionOption,
  type PortionProfileLike,
} from "../portion-scale";

const profiles: PortionProfileLike[] = [
  { portion: "单人份", scenario: "单人份", multiplier: 1, isBase: true, isActive: true, sortOrder: 0 },
  { portion: "社区·2份", scenario: "社区", multiplier: 2, isBase: false, isActive: true, sortOrder: 1 },
  { portion: "小碗菜·10份", scenario: "团餐食堂", multiplier: 10, isBase: false, isActive: true, sortOrder: 2 },
];

describe("份量档案与换算", () => {
  it("档案行映射为下拉选项：label 即落库标签，描述为计算规则", () => {
    expect(toPortionOption(profiles[0])).toEqual({
      value: "单人份",
      label: "单人份",
      description: "基本单元",
    });
    expect(toPortionOption(profiles[1]).description).toBe("单人份 × 2");
    expect(toPortionOption(profiles[2]).description).toBe("单人份 × 10");
  });

  it("getPortionOption 以档案为准，未命中走历史兜底", () => {
    expect(getPortionOption("社区·2份", profiles)?.description).toBe("单人份 × 2");
    expect(getPortionOption("社区·4份", profiles)?.description).toBe("单人份 × 4");
    // 档案未收录的历史值仍可展示
    expect(getPortionOption("社区·4份", [])?.label).toBe("社区·4份");
    expect(getPortionOption("单人份")).toEqual({
      value: "单人份",
      label: "单人份",
      description: "基本单元",
    });
    expect(getPortionOption("不存在", profiles)).toBeNull();
    expect(getPortionOption(null, profiles)).toBeNull();
  });

  it("parsePortionCount 优先档案 multiplier，历史值兜底", () => {
    expect(parsePortionCount("社区·2份", profiles)).toBe(2);
    expect(parsePortionCount("小碗菜")).toBe(1);
    expect(parsePortionCount("一锅10份")).toBe(10);
    expect(parsePortionCount("未知份量")).toBeNull();
    expect(parsePortionCount(null)).toBeNull();
    expect(parsePortionCount(undefined)).toBeNull();
  });

  it("场景（scenario）从档案行按序去重即可得分组", () => {
    // 菜品库分组已由档案 scenario 驱动（app/dishes/page.tsx），此处只锁定去重语义
    const scenarios: string[] = [];
    profiles.forEach((p) => {
      if (p.isActive && !scenarios.includes(p.scenario)) scenarios.push(p.scenario);
    });
    expect(scenarios).toEqual(["单人份", "社区", "团餐食堂"]);
  });

  it("转化倍率 = 目标档案 multiplier ÷ 源档案 multiplier", () => {
    expect(portionScaleFactor("单人份", "小碗菜·10份", profiles)).toBe(10);
    expect(portionScaleFactor("单人份", "社区·2份", profiles)).toBe(2);
    expect(portionScaleFactor("社区·2份", "单人份", profiles)).toBe(0.5);
    expect(portionScaleFactor("社区·2份", "小碗菜·10份", profiles)).toBe(5);
    expect(portionScaleFactor("单人份", null, profiles)).toBeNull();
    expect(portionScaleFactor("未知份量", "单人份", profiles)).toBeNull();
  });
});
