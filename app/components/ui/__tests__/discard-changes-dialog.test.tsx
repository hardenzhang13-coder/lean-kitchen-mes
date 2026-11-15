/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { DiscardChangesDialog } from "../discard-changes-dialog";

describe("放弃未保存改动的确认弹窗", () => {
  it("说明记录类型与后果", () => {
    render(
      <DiscardChangesDialog
        open
        onOpenChange={jest.fn()}
        entityLabel="净料"
        onDiscard={jest.fn()}
      />
    );

    expect(screen.getByText("放弃未保存的修改？")).toBeInTheDocument();
    expect(
      screen.getByText(/当前净料有尚未保存的修改/)
    ).toBeInTheDocument();
  });

  it("「继续编辑」关闭弹窗但不放弃", () => {
    const onOpenChange = jest.fn();
    const onDiscard = jest.fn();
    render(
      <DiscardChangesDialog
        open
        onOpenChange={onOpenChange}
        entityLabel="净料"
        onDiscard={onDiscard}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("「放弃并关闭」触发放弃回调", () => {
    const onDiscard = jest.fn();
    render(
      <DiscardChangesDialog
        open
        onOpenChange={jest.fn()}
        entityLabel="净料"
        onDiscard={onDiscard}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "放弃并关闭" }));
    expect(onDiscard).toHaveBeenCalled();
  });
});
