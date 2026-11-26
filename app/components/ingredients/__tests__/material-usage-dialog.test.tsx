/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import { MaterialUsageDialog } from "../material-usage-dialog";

jest.setTimeout(15_000);

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function mockResponse(payload: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

describe("MaterialUsageDialog 使用概况", () => {
  it("标题与副标题指向当前物料", async () => {
    mockResponse({ data: [], pagination: { totalItems: 0, totalPages: 0 } });

    render(
      <MaterialUsageDialog
        open
        onOpenChange={() => {}}
        fetchUrl="/api/seasoning-products/3/dishes"
        materialName="生抽"
        materialLabel="调料"
      />
    );

    expect(screen.getByText("使用概况")).toBeInTheDocument();
    expect(screen.getByText("引用了「生抽」的菜品")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("有数据时列出菜品编号/名称/份量表头与菜品行", async () => {
    mockResponse({
      data: [
        { id: 1, code: "D-001", name: "宫保鸡丁", portion: "单人份" },
        { id: 2, code: "D-002", name: "鱼香肉丝", portion: null },
      ],
      pagination: { totalItems: 2, totalPages: 1 },
    });

    render(
      <MaterialUsageDialog
        open
        onOpenChange={() => {}}
        fetchUrl="/api/seasoning-products/3/dishes"
        materialName="生抽"
        materialLabel="调料"
      />
    );

    await waitFor(() => expect(screen.getByText("宫保鸡丁")).toBeInTheDocument());

    expect(screen.getByText("菜品编号")).toBeInTheDocument();
    expect(screen.getByText("菜品名称")).toBeInTheDocument();
    expect(screen.getByText("份量")).toBeInTheDocument();
    expect(screen.getByText("D-002")).toBeInTheDocument();
  });

  it("无数据时保留表头并显示缺省页", async () => {
    mockResponse({ data: [], pagination: { totalItems: 0, totalPages: 0 } });

    render(
      <MaterialUsageDialog
        open
        onOpenChange={() => {}}
        fetchUrl="/api/seasoning-products/3/dishes"
        materialLabel="调料"
      />
    );

    await waitFor(() =>
      expect(screen.getByText("暂未用于任何菜品")).toBeInTheDocument()
    );
    // 表头仍在
    expect(screen.getByText("菜品编号")).toBeInTheDocument();
    expect(screen.getByText("当前调料还没有被任何菜品引用")).toBeInTheDocument();
  });
});
