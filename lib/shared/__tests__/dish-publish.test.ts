import { validateDishForPublish } from "../dish-publish";

const validDish = {
  name: "宫保鸡丁",
  meatType: "荤菜",
  price: 18,
  netDetails: [{ role: "main" }],
};

describe("菜品发布校验", () => {
  it("完整档案通过校验", () => {
    expect(validateDishForPublish(validDish)).toBeNull();
  });

  it("类别/菜系/做法/口味可留空", () => {
    const { name, meatType, price, netDetails } = validDish;
    expect(
      validateDishForPublish({ name, meatType, price, netDetails })
    ).toBeNull();
  });

  it("名称与荤素类型必填", () => {
    expect(validateDishForPublish({ ...validDish, name: "  " })).toBe(
      "菜品名称不能为空"
    );
    expect(validateDishForPublish({ ...validDish, meatType: null })).toBe(
      "请选择荤素类型"
    );
  });

  it("售价必填且需大于 0", () => {
    expect(validateDishForPublish({ ...validDish, price: null })).toBe(
      "请填写售价（元/份），毛利率会根据成本自动计算"
    );
    expect(validateDishForPublish({ ...validDish, price: 0 })).toBe(
      "请填写售价（元/份），毛利率会根据成本自动计算"
    );
  });

  it("只要求主料，辅料不再强制", () => {
    expect(
      validateDishForPublish({ ...validDish, netDetails: [{ role: "support" }] })
    ).toBe("主料不能为空");
    expect(validateDishForPublish({ ...validDish, netDetails: [] })).toBe(
      "主料不能为空"
    );
    expect(validateDishForPublish({ ...validDish, netDetails: null })).toBe(
      "主料不能为空"
    );
  });
});
