import {
  DISH_STATUS_ACTIONS,
  DISH_STATUS_OPTIONS,
  DISH_STATUS_TRANSITIONS,
  DISH_STATUS_VALUES,
  canTransitionDishStatus,
  getDishStatusOption,
  getDishStatusTransition,
  isDishStatusAction,
  isValidDishStatus,
} from "../dish-status";

describe("菜品状态枚举与迁移", () => {
  it("枚举取值与选项一一对应", () => {
    expect(DISH_STATUS_VALUES).toEqual(["draft", "published", "inactive"]);
    expect(DISH_STATUS_OPTIONS).toHaveLength(DISH_STATUS_VALUES.length);
    expect(DISH_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      ...DISH_STATUS_VALUES,
    ]);
  });

  it("标签与颜色语义稳定", () => {
    expect(getDishStatusOption("draft")?.label).toBe("草稿");
    expect(getDishStatusOption("published")?.label).toBe("已发布");
    expect(getDishStatusOption("inactive")?.label).toBe("已停用");
    expect(getDishStatusOption("inactive")?.variant).toBe("warning");
    expect(getDishStatusOption("unknown")).toBeNull();
    expect(getDishStatusOption(null)).toBeNull();
  });

  it("合法性判断只接受三态", () => {
    expect(isValidDishStatus("published")).toBe(true);
    expect(isValidDishStatus("pending")).toBe(false);
    expect(isValidDishStatus("")).toBe(false);
    expect(isValidDishStatus(undefined)).toBe(false);
  });

  it("动作迁移表覆盖四类操作", () => {
    expect(DISH_STATUS_ACTIONS).toEqual([
      "publish",
      "unpublish",
      "deactivate",
      "restore",
    ]);
    expect(DISH_STATUS_TRANSITIONS.publish.to).toBe("published");
    expect(DISH_STATUS_TRANSITIONS.unpublish.to).toBe("draft");
    expect(DISH_STATUS_TRANSITIONS.deactivate.to).toBe("inactive");
    expect(DISH_STATUS_TRANSITIONS.restore.to).toBe("published");
  });

  it("按当前状态判断动作是否允许", () => {
    expect(canTransitionDishStatus("draft", "publish")).toBe(true);
    expect(canTransitionDishStatus("published", "publish")).toBe(false);
    expect(canTransitionDishStatus("published", "deactivate")).toBe(true);
    expect(canTransitionDishStatus("inactive", "deactivate")).toBe(false);
    expect(canTransitionDishStatus("inactive", "restore")).toBe(true);
    expect(canTransitionDishStatus("inactive", "unpublish")).toBe(true);
    expect(canTransitionDishStatus("draft", "unpublish")).toBe(false);
  });

  it("动作解析拒绝非法值", () => {
    expect(isDishStatusAction("restore")).toBe(true);
    expect(isDishStatusAction("archive")).toBe(false);
    expect(isDishStatusAction(null)).toBe(false);
    expect(getDishStatusTransition("archive")).toBeNull();
  });
});
