/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { BasicInfoPanel } from "../basic-info-panel";
import type { DishFormData } from "../types";

const data: DishFormData = {
  name: "宫保鸡丁",
  intro: "经典川菜",
  categoryId: "1",
  cuisine: "川菜",
  technique: "爆炒",
  taste: "香辣",
  portion: "小碗菜",
  season: "四季",
  meatType: "荤菜",
  price: "18",
};

function renderPanel() {
  return render(
    <BasicInfoPanel
      data={data}
      onChange={jest.fn()}
      categories={[{ id: 1, code: "HOT", name: "热菜" }]}
      cost={12.345}
    />
  );
}

describe("菜品基础信息表单分组", () => {
  it("估算成本不再在基本信息区单独展示", () => {
    renderPanel();
    expect(screen.queryByText("估算成本")).not.toBeInTheDocument();
    expect(screen.queryByText("元/份")).not.toBeInTheDocument();
  });

  it("基本信息组按名称/份量、售价/毛利排列", () => {
    const { container } = renderPanel();
    expect(screen.getByText("基本信息")).toBeInTheDocument();

    const labels = Array.from(container.querySelectorAll("label")).map(
      (label) => label.textContent ?? ""
    );
    const nameIndex = labels.findIndex((text) => text.includes("菜品名称"));
    const portionIndex = labels.findIndex((text) => text.includes("份量"));
    const priceIndex = labels.findIndex((text) => text.includes("售价"));
    const marginIndex = labels.findIndex((text) => text.includes("毛利率"));

    expect(nameIndex).toBeGreaterThanOrEqual(0);
    expect(nameIndex).toBeLessThan(portionIndex);
    expect(portionIndex).toBeLessThan(priceIndex);
    expect(priceIndex).toBeLessThan(marginIndex);
  });

  it("菜品描述组以荤素类型开头、菜品描述结尾", () => {
    const { container } = renderPanel();
    expect(screen.getByRole("heading", { name: "菜品描述" })).toBeInTheDocument();

    const labels = Array.from(container.querySelectorAll("label")).map(
      (label) => label.textContent ?? ""
    );
    const meatIndex = labels.findIndex((text) => text.includes("荤素类型"));
    const categoryIndex = labels.findIndex((text) => text.includes("菜品类别"));
    const introIndex = labels.findIndex((text) => text.includes("菜品描述"));

    expect(meatIndex).toBeGreaterThanOrEqual(0);
    expect(meatIndex).toBeLessThan(categoryIndex);
    expect(introIndex).toBe(labels.length - 1);
  });

  it("菜品描述使用单行输入框", () => {
    const { container } = renderPanel();
    expect(screen.getByLabelText(/菜品描述/).tagName).toBe("INPUT");
    expect(container.querySelector("textarea")).toBeNull();
  });
});
