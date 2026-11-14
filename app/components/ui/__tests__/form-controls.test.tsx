/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import {
  BusinessFieldInput,
  BusinessNumberInput,
  Input,
  ReadOnlyValue,
  Textarea,
} from "../form-controls";

describe("业务表单输入控件", () => {
  it("默认关闭自动填充、拼写检查与自动纠错", () => {
    render(<Input aria-label="食材名称" defaultValue="带皮五花肉" />);
    const input = screen.getByLabelText("食材名称");

    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("autocapitalize", "none");
  });

  it("登录等场景可以显式覆盖自动填充", () => {
    render(
      <Input
        aria-label="用户名"
        autoComplete="username"
        defaultValue="operator"
      />
    );

    expect(screen.getByLabelText("用户名")).toHaveAttribute(
      "autocomplete",
      "username"
    );
  });

  it("Textarea 使用相同安全默认值", () => {
    render(<Textarea aria-label="备注" defaultValue="测试" />);
    const textarea = screen.getByLabelText("备注");

    expect(textarea).toHaveAttribute("autocomplete", "off");
    expect(textarea).toHaveAttribute("spellcheck", "false");
  });

  it("业务输入可聚焦隐藏占位并在失焦后恢复", () => {
    render(
      <BusinessFieldInput
        aria-label="采购规格"
        placeholder="如 5斤/袋"
        hidePlaceholderOnFocus
      />
    );
    const input = screen.getByLabelText("采购规格");

    fireEvent.focus(input);
    expect(input).toHaveAttribute("placeholder", "");
    fireEvent.blur(input);
    expect(input).toHaveAttribute("placeholder", "如 5斤/袋");
  });

  it("业务数字输入禁止键盘步进并保留手动录入", () => {
    const handleChange = jest.fn();
    render(
      <BusinessNumberInput
        aria-label="最新参照单价"
        defaultValue="10"
        onChange={handleChange}
      />
    );
    const input = screen.getByLabelText("最新参照单价");

    for (const key of ["ArrowUp", "ArrowDown", "PageUp", "PageDown"]) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
    fireEvent.change(input, { target: { value: "12.5" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue(12.5);
  });

  it("只读值支持强调、数字和空值留空", () => {
    const { rerender } = render(
      <ReadOnlyValue value="18.50" numeric emphasis />
    );
    expect(screen.getByText("18.50")).toHaveClass(
      "font-semibold",
      "tabular-nums",
      "text-primary"
    );

    rerender(
      <ReadOnlyValue
        value=""
        numeric
        emphasis
        emptyText="自动计算得出"
      />
    );
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByText("自动计算得出")).toHaveClass(
      "font-normal",
      "text-muted-foreground"
    );
    expect(screen.getByText("自动计算得出")).not.toHaveClass(
      "font-semibold",
      "text-primary"
    );
  });
});
