import {
  CUISINE_OPTIONS,
  CUISINE_VALUES,
  MEAT_TYPE_OPTIONS,
  MEAT_TYPE_VALUES,
  SEASON_OPTIONS,
  SEASON_VALUES,
  TASTE_OPTIONS,
  TASTE_VALUES,
  TECHNIQUE_OPTIONS,
  TECHNIQUE_VALUES,
  getDishFieldLabel,
  isDishFieldValue,
} from "../dish-enums";

describe("菜品基础信息枚举", () => {
  it("选项数组与取值数组保持一致", () => {
    expect(CUISINE_OPTIONS.map((option) => option.value)).toEqual([
      ...CUISINE_VALUES,
    ]);
    expect(TECHNIQUE_OPTIONS.map((option) => option.value)).toEqual([
      ...TECHNIQUE_VALUES,
    ]);
    expect(TASTE_OPTIONS.map((option) => option.value)).toEqual([...TASTE_VALUES]);
    expect(MEAT_TYPE_OPTIONS.map((option) => option.value)).toEqual([
      ...MEAT_TYPE_VALUES,
    ]);
    expect(SEASON_OPTIONS.map((option) => option.value)).toEqual([
      ...SEASON_VALUES,
    ]);
  });

  it("取值数组没有重复项", () => {
    const groups = [
      CUISINE_VALUES,
      TECHNIQUE_VALUES,
      TASTE_VALUES,
      MEAT_TYPE_VALUES,
      SEASON_VALUES,
    ];
    for (const values of groups) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("标签解析与合法性判断", () => {
    expect(getDishFieldLabel(MEAT_TYPE_OPTIONS, "荤菜")).toBe("荤菜");
    expect(getDishFieldLabel(MEAT_TYPE_OPTIONS, "海鲜")).toBe("海鲜");
    expect(getDishFieldLabel(MEAT_TYPE_OPTIONS, null)).toBeNull();
    expect(isDishFieldValue(SEASON_OPTIONS, "四季")).toBe(true);
    expect(isDishFieldValue(SEASON_OPTIONS, "雨季")).toBe(false);
  });
});
