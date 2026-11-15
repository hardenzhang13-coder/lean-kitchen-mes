/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { BomEditor } from "../bom-editor";
import type { BomItem, BomType } from "../types";

const item: BomItem = {
  id: "main-1",
  sourceId: 11,
  name: "青椒丝",
  spec: "500g",
  amountG: "500",
  unitPrice: 2.35,
  unit: "斤",
  costPrice: 4.5,
  cost: 1.23,
  portion: "社区·3份",
  l2Code: "VEG-LEF",
};

const bom: Record<BomType, BomItem[]> = {
  main: [item],
  support: [],
  minor: [],
  seasoning: [],
  sauce: [],
};

describe("菜品用料模块", () => {
  it("估算成本在模块标题处以主题色加粗展示", () => {
    render(
      <BomEditor
        bom={bom}
        onChange={jest.fn()}
        refs={{ ingredientCategories: [] }}
        onLoadItems={async () => []}
      />
    );

    expect(screen.getByText(/估算成本/)).toBeInTheDocument();
    const values = screen.getAllByText("¥1.23");
    expect(
      values.some((value) => value.className.includes("text-primary"))
    ).toBe(true);
    expect(
      values.some((value) => value.className.includes("font-bold"))
    ).toBe(true);
  });
});
