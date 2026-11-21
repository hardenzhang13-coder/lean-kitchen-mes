"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { DataTable } from "@/app/components/ui/data-table";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
import {
  StatusBadge,
  type StatusVariant,
} from "@/app/components/ui/status-badge";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";

interface LedgerRow {
  id: number;
  t: string;
  type: string;
  typeLabel: string;
  code: string | null;
  name: string;
  l1Name: string;
  l2Name: string;
  changePortions: number;
  changeQty: number;
  balancePortions: number;
  balanceQty: number;
  source: string;
  operator: string;
}

interface PageData {
  data: LedgerRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

const TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "stock_in", label: "入库" },
  { value: "stock_out", label: "出库" },
  { value: "stock_rollback", label: "作废回滚" },
] as const;

type TypeFilter = (typeof TYPE_OPTIONS)[number]["value"];

const TYPE_VARIANT: Record<string, StatusVariant> = {
  stock_in: "success",
  stock_out: "danger",
  stock_rollback: "warning",
};

/** 出入库流水 Tab：双单位（份 + g）台账 */
export function LedgerTab() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TypeFilter>("");
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
      if (type) params.set("type", type);
      const res = await fetch("/api/prepped-stock/ledger?" + params.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "加载流水失败");
      }
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setTotal({
        totalItems: json.pagination?.totalItems ?? 0,
        totalPages: json.pagination?.totalPages ?? 1,
      });
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "加载流水失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type]);

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => { fetchRows(); }, [fetchRows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="skeu-panel-toolbar flex shrink-0 flex-wrap items-center gap-2 px-5 py-4">
        <SkeuSegmented
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[...TYPE_OPTIONS]}
          ariaLabel="流水类型"
        />
        <span className="ml-auto text-[13px] font-semibold text-primary">
          共 {total.totalItems} 笔流水
        </span>
      </div>

      <div className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
        {error ? (
          <EmptyState
            icon={AlertCircle}
            title="流水加载失败"
            description={error}
            action={{ label: "重试", onClick: fetchRows }}
            className="flex-1 py-16"
          />
        ) : (
          <DataTable<LedgerRow>
            data={rows}
            loading={loading}
            fillHeight
            variant="skeu"
            tableClassName="min-w-max"
            columns={[
              {
                header: "时间",
                className: "w-[170px]",
                cell: (row) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(row.t).toLocaleString("zh-CN")}
                  </span>
                ),
              },
              {
                header: "类型",
                className: "w-[100px]",
                cell: (row) => (
                  <StatusBadge
                    status={row.typeLabel}
                    variant={TYPE_VARIANT[row.type] ?? "neutral"}
                  />
                ),
              },
              {
                header: "一级分类",
                className: "w-[110px]",
                cell: (row) => row.l1Name,
              },
              {
                header: "名称",
                className: "w-[170px]",
                cell: (row) => (
                  <span className="block font-medium">
                    {row.name}
                    {row.code ? (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {row.code}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                header: "变动份数",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span
                    className={
                      "font-semibold tabular-nums " +
                      (row.type === "stock_out" ? "text-danger" : "text-success")
                    }
                  >
                    {row.type === "stock_out" ? "−" : "+"}
                    {formatPortionsCount(row.changePortions)}
                  </span>
                ),
              },
              {
                header: "变动量",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="text-muted-foreground tabular-nums">
                    {row.type === "stock_out" ? "−" : "+"}
                    {formatWeight(row.changeQty)}
                  </span>
                ),
              },
              {
                header: "结存份数",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="tabular-nums">
                    {formatPortionsCount(row.balancePortions)}
                  </span>
                ),
              },
              {
                header: "结存量",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="text-muted-foreground tabular-nums">
                    {formatWeight(row.balanceQty)}
                  </span>
                ),
              },
              {
                header: "来源单据",
                className: "w-[180px]",
                cell: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {row.source}
                  </span>
                ),
              },
              {
                header: "操作人",
                className: "w-[100px]",
                cell: (row) => row.operator,
              },
            ]}
            pagination={{
              currentPage: page,
              totalPages: total.totalPages,
              totalItems: total.totalItems,
              pageSize,
              onPageChange: setPage,
              totalLabel: `共 ${total.totalItems} 笔流水`,
              showPageSize: true,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
            emptyState={{ title: "暂无出入库流水" }}
          />
        )}
      </div>
    </div>
  );
}
