"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/app/components/ui/pagination";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";

interface OutboundRow {
  id: number;
  code: string;
  storeName: string;
  scheduleCode: string | null;
  scheduleTitle: string;
  scheduleDate: string;
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

/** 出库单 Tab：序号/单号/门店/来源排程单名称/出库份数/合计金额/是否按计划出库/状态/库管负责人/创建时间/操作 */
export function OutboundTab() {
  const router = useRouter();
  const [rows, setRows] = useState<OutboundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState({ totalItems: 0, totalPages: 1 });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/outbound-orders?page=${page}&pageSize=${pageSize}`);
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setTotal({ totalItems: json.pagination?.totalItems ?? 0, totalPages: json.pagination?.totalPages ?? 1 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const start = total.totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total.totalItems);

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="还没有出库单"
          description="点击右上角「创建出库单」，按排程为门店出库净菜"
          action={{ label: "创建出库单", onClick: () => router.push("/inventory/outbound/new") }}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>序号</TableHead>
                <TableHead>出库单号</TableHead>
                <TableHead>门店</TableHead>
                <TableHead>来源排程单名称</TableHead>
                <TableHead className="text-right">出库份数</TableHead>
                <TableHead className="text-right">合计金额</TableHead>
                <TableHead>是否按计划出库</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>库管负责人</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((o, idx) => (
                <TableRow key={o.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">
                    {String((page - 1) * pageSize + idx + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{o.code}</TableCell>
                  <TableCell>{o.storeName}</TableCell>
                  <TableCell className="max-w-[220px] truncate" title={o.scheduleTitle}>{o.scheduleTitle}</TableCell>
                  <TableCell className="text-right">{formatPortionsCount(o.totalPortions)}</TableCell>
                  <TableCell className="text-right font-medium">¥{o.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    {o.asPlanned ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">是</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">否</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.status === "confirmed" ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">已出库</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">已作废</span>
                    )}
                  </TableCell>
                  <TableCell>{o.operator}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(o.createdAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-primary text-sm font-medium hover:underline"
                      onClick={() => router.push(`/inventory/outbound/${o.id}`)}
                    >
                      详情
                    </button>
                  </TableCell>
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