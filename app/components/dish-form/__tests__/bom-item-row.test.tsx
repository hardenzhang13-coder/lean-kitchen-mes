/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { BomItemRow } from "../bom-item-row";
import type { BomItem } from "../types";

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

describe("菜品 BOM 行", () => {
  it("展示份量标签且不再提供用量输入", () => {
    const { container } = render(
      <BomItemRow item={item} type="main" index={0} onRemove={jest.fn()} />
    );

    expect(screen.getByText("社区·3份")).toBeInTheDocument();
    expect(screen.getByText("¥1.23")).toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
  });

  it("调料行展示克数输入框", () => {
    const { container } = render(
      <BomItemRow
        item={{ ...item, portion: null, spec: "1.9L*6", amountG: "10" }}
        type="seasoning"
        index={0}
        onRemove={jest.fn()}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText("1.9L*6")).toBeInTheDocument();
    expect(container.querySelector("input")).not.toBeNull();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("无份量的酱料显示占位符", () => {
    const { container } = render(
      <BomItemRow
        item={{ ...item, portion: null, spec: "1.9L*6" }}
        type="sauce"
        index={0}
        onRemove={jest.fn()}
      />
    );

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(container.querySelector("input")).toBeNull();
  });
});
