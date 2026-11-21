import {
  PORTION_OPTIONS,
  PORTION_VALUES,
  getDishPortionGroup,
  getPortionOption,
  isDishPortionGroup,
  isValidPortion,
  parsePortionCount,
  portionScaleFactor,
} from "../portion-scale";

describe("份量枚举与换算", () => {
  it("枚举取值与净料/菜品共用同一套口径", () => {
    expect(PORTION_VALUES).toEqual([
      "小碗菜",
      "小碗菜·10份",
      "社区·1份",
      "社区·2份",
      "社区·3份",
      "社区·4份",
    ]);
    expect(PORTION_OPTIONS).toHaveLength(PORTION_VALUES.length);
  });

  it("按小碗菜等价份数解析份量", () => {
    expect(parsePortionCount("小碗菜")).toBe(1);
    expect(parsePortionCount("小碗菜·10份")).toBe(10);
    expect(parsePortionCount("社区·1份")).toBe(2);
    expect(parsePortionCount("社区·2份")).toBe(4);
    expect(parsePortionCount("社区·3份")).toBe(6);
    expect(parsePortionCount("社区·4份")).toBe(8);
  });

  it("兼容历史份量值并对未知值返回 null", () => {
    expect(parsePortionCount("单人份")).toBe(1);
    expect(parsePortionCount("一锅10份")).toBe(10);
    expect(parsePortionCount("未知份量")).toBeNull();
    expect(parsePortionCount(null)).toBeNull();
    expect(parsePortionCount(undefined)).toBeNull();
  });

  it("份量元数据可查询并校验合法性", () => {
    expect(getPortionOption("社区·2份")?.bowlEquivalent).toBe(4);
    expect(getPortionOption("社区·2份")?.description).toBe("小碗菜 ×4");
    expect(getPortionOption("社区·1份")?.bowlEquivalent).toBe(2);
    expect(getPortionOption("社区·1份")?.description).toBe("小碗菜 ×2");
    expect(getPortionOption("不存在")).toBeNull();
    expect(isValidPortion("小碗菜·10份")).toBe(true);
    expect(isValidPortion("单人份")).toBe(false);
  });

  it("菜品库按小碗菜 / 10 份 / 其余归入三档", () => {
    expect(getDishPortionGroup("小碗菜")).toBe("single");
    expect(getDishPortionGroup("小碗菜·10份")).toBe("canteen");
    expect(getDishPortionGroup("社区·1份")).toBe("community");
    expect(getDishPortionGroup("社区·4份")).toBe("community");
    expect(getDishPortionGroup(null)).toBe("community");
    expect(isDishPortionGroup("single")).toBe(true);
    expect(isDishPortionGroup("unknown")).toBe(false);
  });

  it("转化倍率按小碗菜等价份数推导", () => {
    expect(portionScaleFactor("小碗菜", "小碗菜·10份")).toBe(10);
    expect(portionScaleFactor("小碗菜", "社区·2份")).toBe(4);
    expect(portionScaleFactor("社区·2份", "小碗菜")).toBe(0.25);
    expect(portionScaleFactor("社区·3份", "社区·4份")).toBe(
      Number((8 / 6).toFixed(4))
    );
    expect(portionScaleFactor("小碗菜", null)).toBeNull();
  });
});