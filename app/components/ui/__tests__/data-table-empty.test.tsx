/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { DataTable } from "@/app/components/ui/data-table";

type Row = { id: number; code: string; name: string };

const columns = [
  { header: "菜品编号", cell: (row: Row) => row.code },
  { header: "菜品名称", cell: (row: Row) => row.name },
];

describe("DataTable 空数据", () => {
  it("空数据时保留表头，空态收进表体", () => {
    render(
      <DataTable<Row>
        data={[]}
        columns={columns}
        emptyState={{ title: "暂未用于任何菜品", description: "当前调料还没有被任何菜品引用" }}
      />
    );

    // 表头仍在
    expect(screen.getByText("菜品编号")).toBeInTheDocument();
    expect(screen.getByText("菜品名称")).toBeInTheDocument();
    // 空态进入表体
    expect(screen.getByText("暂未用于任何菜品")).toBeInTheDocument();
    expect(screen.getByText("当前调料还没有被任何菜品引用")).toBeInTheDocument();
  });

  it("有数据时表头与行同时渲染", () => {
    render(
      <DataTable<Row>
        data={[{ id: 1, code: "D-001", name: "宫保鸡丁" }]}
        columns={columns}
        emptyState={{ title: "暂未用于任何菜品" }}
      />
    );

    expect(screen.getByText("菜品编号")).toBeInTheDocument();
    expect(screen.getByText("D-001")).toBeInTheDocument();
    expect(screen.queryByText("暂未用于任何菜品")).not.toBeInTheDocument();
  });

  it("loading 态同样保留表头", async () => {
    render(<DataTable<Row> data={[]} columns={columns} loading />);

    await waitFor(() => {
      expect(screen.getByText("菜品编号")).toBeInTheDocument();
    });
  });
});
