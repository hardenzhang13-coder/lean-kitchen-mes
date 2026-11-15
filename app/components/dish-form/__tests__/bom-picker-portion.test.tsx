/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
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
});