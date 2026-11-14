/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { NetLabelPrintDialog } from "../net-label-print-dialog";

describe("净料标签打印弹窗", () => {
  const openMock = jest.fn();

  beforeEach(() => {
    openMock.mockReset();
    window.open = openMock;
  });

  it("默认打印 1 张并校验正整数", () => {
    const onOpenChange = jest.fn();
    render(
      <NetLabelPrintDialog
        target={{ id: 21, name: "平包菜•称重•500g", packageSpec: 500 }}
        onOpenChange={onOpenChange}
      />
    );

    const input = screen.getByLabelText("本次打印数量");
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "进入打印" }));
    expect(screen.getByText("请输入大于 0 的整数")).toBeInTheDocument();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("使用用户输入张数打开净料标签页", () => {
    const onOpenChange = jest.fn();
    render(
      <NetLabelPrintDialog
        target={{ id: 21, name: "平包菜•称重•500g", packageSpec: 500 }}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.change(screen.getByLabelText("本次打印数量"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "进入打印" }));

    expect(openMock).toHaveBeenCalledWith(
      "/ingredients/net/21/labels?copies=3",
      "_blank",
      "noopener,noreferrer"
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
