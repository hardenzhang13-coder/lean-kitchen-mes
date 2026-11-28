"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { DataTable } from "@/app/components/ui/data-table";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SelectField } from "@/app/components/ui/select-field";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { useDebounce } from "@/lib/client/hooks";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";

interface StockRow {
  key: string;
  sourceType: string;
  sourceId: number;
  code: string;
  name: string;
  l1Name: string;
  l2Name: string;
  portions: number;
  qtyG: number;
  updatedAt: string;
}

interface PageData {
  data: StockRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  filters?: { availableL1: string[] };
}

/** 当前库存 Tab：库存份数 + 库存量(g) 双字段，无汇总 KPI */
export function StockTab() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [l1, setL1] = useState("全部");
  const [availableL1, setAvailableL1] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState({ totalItems: 0, totalPages: 1 });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (l1 !== "全部") params.set("l1", l1);
      const res = await fetch("/api/prepped-stock?" + params.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "加载库存失败");
      }
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setAvailableL1(json.filters?.availableL1 ?? []);
      setTotal({
        totalItems: json.pagination?.totalItems ?? 0,
        totalPages: json.pagination?.totalPages ?? 1,
      });
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "加载库存失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, l1]);

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => { fetchRows(); }, [fetchRows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const l1Options = useMemo(
    () => ["全部", ...availableL1].map((value) => ({ value, label: value })),
    [availableL1]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="skeu-panel-toolbar shrink-0 px-5 py-4">
        <ListToolbar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="搜索名称或编号..."
          onReset={() => {
            setSearch("");
            setL1("全部");
            setPage(1);
          }}
          hasFilters={l1 !== "全部"}
        >
          <SelectField
            value={l1}
            onChange={(value) => {
              setL1(value);
              setPage(1);
            }}
            options={l1Options}
            className="w-[150px]"
          />
        </ListToolbar>
      </div>

      <div className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
        {error ? (
          <EmptyState
            icon={AlertCircle}
            title="库存加载失败"
            description={error}
            action={{ label: "重试", onClick: fetchRows }}
            tone="danger"
            className="flex-1 py-16"
          />
        ) : (
          <DataTable<StockRow>
            data={rows}
            loading={loading}
            fillHeight
            variant="skeu"
            tableClassName="min-w-max"
            columns={[
              {
                header: "一级分类",
                className: "w-[110px]",
                cell: (row) => <span className="font-medium">{row.l1Name}</span>,
              },
              {
                header: "二级分类",
                className: "w-[110px]",
                cell: (row) => (
                  <span className="text-muted-foreground">{row.l2Name}</span>
                ),
              },
              {
                header: "编号",
                className: "w-[120px]",
                cell: (row) => (
                  <span className="font-mono text-xs">{row.code}</span>
                ),
              },
              {
                header: "名称",
                className: "w-[160px]",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                header: "库存份数",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="font-semibold tabular-nums">
                    {formatPortionsCount(row.portions)}
                  </span>
                ),
              },
              {
                header: "库存量",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="text-muted-foreground tabular-nums">
                    {formatWeight(row.qtyG)}
                  </span>
                ),
              },
              {
                header: "最近变动",
                className: "w-[170px]",
                cell: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString("zh-CN")}
                  </span>
                ),
              },
            ]}
            pagination={{
              currentPage: page,
              totalPages: total.totalPages,
              totalItems: total.totalItems,
              pageSize,
              onPageChange: setPage,
              totalLabel: `共 ${total.totalItems} 种净菜`,
              showPageSize: true,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
            emptyState={{
              title: "暂无净菜库存",
              description:
                "库存为 0 的净菜不会显示；完成生产并确认入库后会出现在这里",
            }}
          />
        )}
      </div>
    </div>
  );
}
