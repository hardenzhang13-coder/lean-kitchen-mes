/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BomEditor } from "../bom-editor";
import { emptyBom, type BomItem, type BomType, type IngredientOption } from "../types";

const seasoningOption: IngredientOption = {
  id: 30,
  code: "SEA-SOL-0030",
  name: "生抽",
  productName: "海天",
  spec: "1.9L*6",
  unitPrice: 120,
  costPrice: 10,
  unit: "斤",
  l2Code: "SEA-SOL",
};

function renderEditor(bom: Record<BomType, BomItem[]>) {
  const onChange = jest.fn();
  render(
    <BomEditor
      bom={bom}
      onChange={onChange}
      refs={{
        ingredientCategories: [
          {
            code: "SEA",
            name: "调味品",
            children: [{ code: "SEA-SOL", name: "酱油", parentCode: "SEA" }],
          },
        ],
      }}
      onLoadItems={async () => [seasoningOption]}
    />
  );
  return { onChange };
}

describe("菜品用料模块 · 调料选择与克数录入", () => {
  it("调料弹窗填克数后生成可编辑的调料行", async () => {
    const { onChange } = renderEditor(emptyBom());

    // 第 4 个分组是「调料」
    const addButtons = screen.getAllByRole("button", { name: /添加/ });
    fireEvent.click(addButtons[3]);

    await waitFor(() => expect(screen.getByText("生抽")).toBeInTheDocument());
    expect(screen.getByText("用量")).toBeInTheDocument();

    fireEvent.click(screen.getByText("生抽").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls.at(-1)?.[0] as Record<BomType, BomItem[]>;
    expect(updated.seasoning).toHaveLength(1);
    expect(updated.seasoning[0].amountG).toBe("10");
    // 成本 = 每斤单价 10 元/斤 × 10g ÷ 500
    expect(updated.seasoning[0].cost).toBe(0.2);
  });

  it("弹窗内改克数后按新克数写入", async () => {
    const { onChange } = renderEditor(emptyBom());

    const addButtons = screen.getAllByRole("button", { name: /添加/ });
    fireEvent.click(addButtons[3]);

    await waitFor(() => expect(screen.getByText("生抽")).toBeInTheDocument());

    const amountInput = screen.getByDisplayValue("10");
    fireEvent.change(amountInput, { target: { value: "25" } });

    fireEvent.click(screen.getByText("生抽").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    const updated = onChange.mock.calls.at(-1)?.[0] as Record<BomType, BomItem[]>;
    expect(updated.seasoning[0].amountG).toBe("25");
    expect(updated.seasoning[0].cost).toBe(0.5);
  });
});