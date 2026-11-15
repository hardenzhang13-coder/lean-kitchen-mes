/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { Pagination } from "../pagination";
import { formatPageSummary } from "@/lib/client/use-pagination";

describe("统一分页", () => {
  it("生成完整区间汇总", () => {
    expect(formatPageSummary(2, 10, 48, "原料")).toBe(
      "第 11-20 条，共 48 条 原料"
    );
  });

  it("统一只保留上一页、页码和下一页", () => {
    const onPageChange = jest.fn();
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={2}
        onPageChange={onPageChange}
      />
    );

    expect(container.firstChild).toHaveClass("h-12", "pt-4");
    expect(
      screen.getByRole("button", { name: /上一页/ })
    ).toBeDisabled();
    expect(
      screen.queryByRole("combobox", { name: "每页显示条数" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /首页|尾页/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/第 1-10 条/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /下一页/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("可选展示汇总文案与每页条数选择器", () => {
    const onPageSizeChange = jest.fn();
    render(
      <Pagination
        currentPage={1}
        totalPages={3}
        totalItems={48}
        onPageChange={jest.fn()}
        totalLabel="共 48 条原料"
        showPageSize
        pageSize={20}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByText("共 48 条原料")).toBeInTheDocument();
    expect(screen.getByText("每页显示")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /下一页/ })
    ).toBeInTheDocument();
  });

  it("无数据时不渲染分页底栏", () => {
    const { container } = render(
      <Pagination
        currentPage={1}
        totalPages={1}
        totalItems={0}
        onPageChange={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
