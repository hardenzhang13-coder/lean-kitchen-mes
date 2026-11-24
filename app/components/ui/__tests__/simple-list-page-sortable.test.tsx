/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SimpleListPage } from "../simple-list-page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

type Row = { id: number; name: string; isActive: boolean };

const ROWS: Row[] = [
  { id: 11, name: "A一", isActive: true },
  { id: 22, name: "A二", isActive: true },
  { id: 33, name: "A三", isActive: true },
  { id: 44, name: "B四", isActive: true },
];

function renderPage() {
  const loader = jest.fn(async () => ROWS);
  render(
    <SimpleListPage<Row>
      title="测试清单"
      entityLabel="条目"
      loader={loader}
      statusFilter
      sortable={{
        endpoint: "/api/test/reorder",
        getId: (row) => row.id,
        getLabel: (row) => row.name,
      }}
      columns={[{ header: "名称", cell: (row) => row.name }]}
    />
  );
  return loader;
}

/** 取某一行的上移 / 下移按钮 */
function sortButtons(name: string) {
  const row = screen.getByText(name).closest("tr") as HTMLElement;
  const up = row.querySelector<HTMLButtonElement>('[aria-label^="上移"]');
  const down = row.querySelector<HTMLButtonElement>('[aria-label^="下移"]');
  return { up: up as HTMLButtonElement, down: down as HTMLButtonElement };
}

/** 当前表格里的名称顺序（首列是序号列，名称在第二列） */
function currentOrder(): (string | null)[] {
  return Array.from(document.querySelectorAll("tbody tr")).map(
    (row) => row.querySelectorAll("td")[1]?.textContent ?? null
  );
}

describe("SimpleListPage 排序能力", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("渲染上移 / 下移按钮，首行禁用上移、末行禁用下移", async () => {
    renderPage();
    await screen.findByText("A一");

    expect(sortButtons("A一").up.disabled).toBe(true);
    expect(sortButtons("A一").down.disabled).toBe(false);
    expect(sortButtons("A二").up.disabled).toBe(false);
    expect(sortButtons("A二").down.disabled).toBe(false);
    expect(sortButtons("B四").down.disabled).toBe(true);
  });

  it("下移一行时提交整表有序 id 列表并本地换位", async () => {
    renderPage();
    await screen.findByText("A一");

    fireEvent.click(sortButtons("A一").down);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/test/reorder");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ ids: [22, 11, 33, 44] });

    await waitFor(() =>
      expect(currentOrder()).toEqual(["A二", "A一", "A三", "B四"])
    );
  });

  it("服务端拒绝时提示错误且不改动本地顺序", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "类别列表已变化，请刷新后重试" }),
    });
    renderPage();
    await screen.findByText("A一");

    fireEvent.click(sortButtons("A一").down);

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(currentOrder()).toEqual(["A一", "A二", "A三", "B四"]);
  });

  it("搜索生效时排序按钮整体禁用", async () => {
    renderPage();
    await screen.findByText("A一");

    // 命中三条，中间行的下移本可用，搜索生效后必须禁用
    fireEvent.change(screen.getByPlaceholderText(/搜索/), {
      target: { value: "A" },
    });

    await waitFor(() => expect(sortButtons("A二").down.disabled).toBe(true));
    expect(sortButtons("A二").up.disabled).toBe(true);
  });
});
