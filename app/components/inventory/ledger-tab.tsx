"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/app/components/ui/pagination";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge, type StatusVariant } from "@/app/components/ui/status-badge";
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
  { key: "全部", value: "" },
  { key: "入库", value: "stock_in" },
  { key: "出库", value: "stock_out" },
  { key: "作废回滚", value: "stock_rollback" },
] as const;

const TYPE_VARIANT: Record<string, StatusVariant> = {
  stock_in: "success",
  stock_out: "danger",
  stock_rollback: "warning",
};

/** 出入库流水 Tab：双单位（份 + g）台账 */
export function LedgerTab() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState({ totalItems: 0, totalPages: 1 });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (type) params.set("type", type);
      const res = await fetch("/api/prepped-stock/ledger?" + params.toString());
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setTotal({ totalItems: json.pagination?.totalItems ?? 0, totalPages: json.pagination?.totalPages ?? 1 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const start = total.totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total.totalItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setType(t.value); setPage(1); }}
              className={
                "px-3 py-1.5 rounded-lg border text-sm transition-colors " +
                (type === t.value
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {t.key}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">共 {total.totalItems} 笔</span>
      </div>

      {loading ? (
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <EmptyState title="暂无出入库流水" />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>一级分类</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="text-right">变动（份）</TableHead>
                <TableHead className="text-right">变动（量）</TableHead>
                <TableHead className="text-right">结存（份）</TableHead>
                <TableHead className="text-right">结存（量）</TableHead>
                <TableHead>来源单据</TableHead>
                <TableHead>操作人</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(r.t).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={r.typeLabel}
                      variant={TYPE_VARIANT[r.type] ?? "neutral"}
                    />
                  </TableCell>
                  <TableCell>{r.l1Name}</TableCell>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.code && <span className="block font-mono text-[11px] text-muted-foreground">{r.code}</span>}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-semibold " +
                      (r.type === "stock_out" ? "text-danger" : "text-success")
                    }
                  >
                    {r.type === "stock_out" ? "−" : "+"}{formatPortionsCount(r.changePortions)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.type === "stock_out" ? "−" : "+"}{formatWeight(r.changeQty)}
                  </TableCell>
                  <TableCell className="text-right">{formatPortionsCount(r.balancePortions)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatWeight(r.balanceQty)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.source}</TableCell>
                  <TableCell>{r.operator}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={total.totalPages}
        totalItems={total.totalItems}
        start={start}
        end={end}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
