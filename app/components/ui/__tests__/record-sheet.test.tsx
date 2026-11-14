/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { RecordActions, RecordSheet } from "../record-sheet";

describe("通用详情抽屉", () => {
  it("操作槽位固定为危险操作、次级操作、核心操作", () => {
    render(
      <RecordActions
        destructive={<button type="button">删除</button>}
        secondary={<button type="button">编辑</button>}
        primary={<button type="button">转净料</button>}
      />
    );

    const destructive = screen.getByRole("button", { name: "删除" });
    const secondary = screen.getByRole("button", { name: "编辑" });
    const primary = screen.getByRole("button", { name: "转净料" });

    expect(
      destructive.compareDocumentPosition(secondary) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
    expect(
      secondary.compareDocumentPosition(primary) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0);
  });

  it("统一渲染标题、摘要、内容和底部操作", () => {
    render(
      <RecordSheet
        open
        onOpenChange={jest.fn()}
        title="原料详情"
        meta={<span>ING-0011</span>}
        footer={<button type="button">编辑</button>}
      >
        <div>详情内容</div>
      </RecordSheet>
    );

    expect(
      screen.getByRole("heading", { name: "原料详情" })
    ).toBeInTheDocument();
    expect(screen.getByText("ING-0011")).toBeInTheDocument();
    expect(screen.getByText("详情内容")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
  });
});
