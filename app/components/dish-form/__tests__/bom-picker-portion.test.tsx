/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BomPickerDialog } from "../bom-picker-dialog";
import { IngredientOption } from "../types";

const netOption: IngredientOption = {
  id: 11,
  code: "PRD-0011",
  name: "青椒丝",
  productName: "青椒",
  spec: "500g",
  unitPrice: 2.35,
  costPrice: 4.5,
  packageSpec: 500,
  unit: "斤",
  l2Code: "VEG-LEF",
  portion: "社区·2份",
};

const secondOption: IngredientOption = {
  ...netOption,
  id: 12,
  code: "PRD-0012",
  name: "土豆丝",
  portion: "小碗菜",
};

const refs = {
  ingredientCategories: [
    {
      code: "VEG",
      name: "蔬菜",
      children: [{ code: "VEG-LEF", name: "叶菜", parentCode: "VEG" }],
    },
  ],
};

describe("菜品 BOM 选择器的份量标签", () => {
  it("净料行展示档案份量标签", async () => {
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="main"
        onSelect={jest.fn()}
        refs={refs}
        onLoadItems={async () => [netOption]}
      />
    );

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    expect(screen.getByText("份量")).toBeInTheDocument();
    expect(screen.getByText("社区·2份")).toBeInTheDocument();
  });

  it("净料无份量时显示占位符", async () => {
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="main"
        onSelect={jest.fn()}
        refs={refs}
        onLoadItems={async () => [{ ...netOption, portion: null }]}
      />
    );

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    expect(screen.queryByText("社区·2份")).not.toBeInTheDocument();
  });

  it("菜品 BOM 模式隐藏用量输入，直接采用封装规格", async () => {
    const onSelect = jest.fn();
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="main"
        onSelect={onSelect}
        refs={refs}
        onLoadItems={async () => [netOption]}
        showAmountInput={false}
      />
    );

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    expect(screen.queryByText("用量")).not.toBeInTheDocument();
    expect(screen.queryByText("取消")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("青椒丝").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    expect(onSelect).toHaveBeenCalledWith([
      { option: netOption, amountG: "500" },
    ]);
  });

  it("菜品 BOM 为单选：再次选择会替换前一项", async () => {
    const onSelect = jest.fn();
    render(
      <BomPickerDialog
        open
        onOpenChange={jest.fn()}
        type="main"
        onSelect={onSelect}
        refs={refs}
        onLoadItems={async () => [netOption, secondOption]}
        showAmountInput={false}
        singleSelect
      />
    );

    await waitFor(() => expect(screen.getByText("青椒丝")).toBeInTheDocument());
    fireEvent.click(screen.getByText("青椒丝").closest("tr")!);
    fireEvent.click(screen.getByText("土豆丝").closest("tr")!);
    fireEvent.click(screen.getByText("确认选择"));

    expect(onSelect).toHaveBeenCalledWith([
      { option: secondOption, amountG: "500" },
    ]);
  });
});