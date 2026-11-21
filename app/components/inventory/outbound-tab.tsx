"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye } from "lucide-react";
import { DataTable } from "@/app/components/ui/data-table";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";

interface OutboundRow {
  id: number;
  code: string;
  subjectType: "store" | "cutting_center";
  subjectName: string;
  sourceCode: string | null;
  sourceTitle: string;
  sourceDate: string;
  totalPortions: number;
  totalAmount: number;
  asPlanned: boolean;
  status: string;
  operator: string;
  createdAt: string;
}

interface PageData {
  data: OutboundRow[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "confirmed", label: "已出库" },
  { value: "voided", label: "已作废" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

/** 出库单 Tab：按计划/状态/金额与来源单据，详情走行内主操作 */
export function OutboundTab() {
  const router = useRouter();
  const [rows, setRows] = useState<OutboundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("");
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
      if (status) params.set("status", status);
      const res = await fetch("/api/outbound-orders?" + params.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "加载出库单失败");
      }
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setTotal({
        totalItems: json.pagination?.totalItems ?? 0,
        totalPages: json.pagination?.totalPages ?? 1,
      });
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "加载出库单失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => { fetchRows(); }, [fetchRows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="skeu-panel-toolbar flex shrink-0 flex-wrap items-center gap-2 px-5 py-4">
        <SkeuSegmented
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[...STATUS_OPTIONS]}
          ariaLabel="出库单状态"
        />
        <span className="ml-auto text-[13px] font-semibold text-primary">
          共 {total.totalItems} 张出库单
        </span>
      </div>

      <div className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
        {error ? (
          <EmptyState
            icon={AlertCircle}
            title="出库单加载失败"
            description={error}
            action={{ label: "重试", onClick: fetchRows }}
            className="flex-1 py-16"
          />
        ) : (
          <DataTable<OutboundRow>
            data={rows}
            loading={loading}
            fillHeight
            variant="skeu"
            actionsWidth="w-[110px]"
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[64px]",
                cell: (_row, rowIdx) => (
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(rowIdx + 1).padStart(2, "0")}
                  </span>
                ),
              },
              {
                header: "出库单号",
                className: "w-[150px]",
                cell: (row) => (
                  <span className="font-mono text-xs">{row.code}</span>
                ),
              },
              {
                header: "出库主体",
                className: "w-[140px]",
                cell: (row) => row.subjectName,
              },
              {
                header: "来源单据",
                className: "w-[220px]",
                cell: (row) => (
                  <span
                    className="block max-w-[220px] truncate"
                    title={row.sourceTitle}
                  >
                    {row.sourceTitle}
                  </span>
                ),
              },
              {
                header: "出库份数",
                className: "w-[100px] text-right",
                cell: (row) => (
                  <span className="font-semibold tabular-nums">
                    {formatPortionsCount(row.totalPortions)}
                  </span>
                ),
              },
              {
                header: "合计金额",
                className: "w-[110px] text-right",
                cell: (row) => (
                  <span className="font-medium tabular-nums">
                    ¥{row.totalAmount.toFixed(2)}
                  </span>
                ),
              },
              {
                header: "是否按计划",
                className: "w-[110px]",
                cell: (row) => (
                  <StatusBadge
                    status={row.asPlanned ? "是" : "否"}
                    variant={row.asPlanned ? "success" : "warning"}
                  />
                ),
              },
              {
                header: "状态",
                className: "w-[100px]",
                cell: (row) => (
                  <StatusBadge
                    status={row.status === "confirmed" ? "已出库" : "已作废"}
                    variant={row.status === "confirmed" ? "success" : "danger"}
                  />
                ),
              },
              {
                header: "库管负责人",
                className: "w-[110px]",
                cell: (row) => row.operator,
              },
              {
                header: "创建时间",
                className: "w-[170px]",
                cell: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("zh-CN")}
                  </span>
                ),
              },
            ]}
            rowActions={(row) => (
              <SkeuActionButton
                label="详情"
                icon={<Eye className="h-3.5 w-3.5" />}
                onClick={() => router.push(`/inventory/outbound/${row.id}`)}
              />
            )}
            pagination={{
              currentPage: page,
              totalPages: total.totalPages,
              totalItems: total.totalItems,
              pageSize,
              onPageChange: setPage,
              totalLabel: `共 ${total.totalItems} 张出库单`,
              showPageSize: true,
              onPageSizeChange: (size) => {
                setPageSize(size);
                setPage(1);
              },
            }}
            emptyState={{
              title: "还没有出库单",
              description:
                "点击右上角「创建出库单」，按排程单或内部生产单出库净菜",
            }}
          />
        )}
      </div>
    </div>
  );
}
