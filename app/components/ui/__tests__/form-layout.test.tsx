/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { FormLayout, FormSection } from "../form-field";

describe("通用表单布局", () => {
  it("分组标题可省略", () => {
    render(
      <FormSection cols={1}>
        <span>核心字段</span>
      </FormSection>
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("核心字段")).toBeInTheDocument();
  });

  it("工作台与抽屉布局使用不同容器策略", () => {
    const { rerender } = render(
      <FormLayout variant="workbench">
        <div>分组</div>
      </FormLayout>
    );
    expect(screen.getByText("分组").parentElement).toHaveClass(
      "lg:grid-cols-3"
    );

    rerender(
      <FormLayout variant="sheet">
        <div>分组</div>
      </FormLayout>
    );
    expect(screen.getByText("分组").parentElement).toHaveClass("space-y-4");
  });
});
