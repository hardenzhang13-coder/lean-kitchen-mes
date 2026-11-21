/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { SkeuButton } from "../skeu-button";
import { SkeuToggle } from "../skeu-toggle";
import { SkeuSearch } from "../skeu-search";
import { SkeuDotSelect } from "../skeu-dot-select";
import { StatusBadge } from "../status-badge";
import { DataTable } from "../data-table";

describe("轻拟物基座组件", () => {
  it("SkeuButton 渲染主操作并带拟物类", () => {
    render(<SkeuButton>新增一级分类</SkeuButton>);
    const button = screen.getByRole("button", { name: "新增一级分类" });
    expect(button).toHaveClass("skeu-btn", "skeu-btn-primary");
  });

  it("SkeuToggle 暴露 switch 语义并可切换", () => {
    const onCheckedChange = jest.fn();
    render(
      <SkeuToggle checked={false} onCheckedChange={onCheckedChange} label="全部展开" />
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("全部展开")).toBeInTheDocument();
    toggle.click();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("SkeuSearch 有内容时出现清除按钮", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SkeuSearch value="" onChange={onChange} placeholder="搜索编号或名称..." />
    );
    expect(screen.queryByLabelText("清除搜索")).not.toBeInTheDocument();

    rerender(
      <SkeuSearch value="VEG" onChange={onChange} placeholder="搜索编号或名称..." />
    );
    const clear = screen.getByLabelText("清除搜索");
    clear.click();
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("SkeuDotSelect 渲染触发器当前值与圆点语义", () => {
    render(
      <SkeuDotSelect
        value="active"
        onChange={() => {}}
        options={[
          { value: "all", label: "全部", tone: "all" },
          { value: "active", label: "启用中", tone: "success" },
        ]}
      />
    );
    expect(screen.getByText("启用中")).toBeInTheDocument();
    expect(document.querySelector(".skeu-dot-success")).toBeInTheDocument();
  });

  it("StatusBadge 为胶囊徽章并带语义圆点", () => {
    render(<StatusBadge status="启用中" variant="success" />);
    const badge = screen.getByText("启用中");
    expect(badge).toHaveClass("skeu-badge");
    expect(badge.querySelector("span")).toBeInTheDocument();
  });

  it("DataTable 拟物形态输出树形行层级标记", () => {
    render(
      <DataTable
        variant="skeu"
        data={[{ id: 1, name: "叶菜" }]}
        getRowLevel={(row) => (row.id === 1 ? "l2" : "l1")}
        columns={[{ header: "名称", accessorKey: "name" }]}
      />
    );
    const row = screen.getByText("叶菜").closest("tr");
    expect(row).toHaveAttribute("data-row-level", "l2");
  });
});