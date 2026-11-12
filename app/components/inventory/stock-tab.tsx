"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/app/components/ui/pagination";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";
import { useDebounce } from "@/lib/client/hooks";

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
  const [type, setType] = useState<"全部" | "net" | "minor">("全部");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState({ totalItems: 0, totalPages: 1 });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (l1 !== "全部") params.set("l1", l1);
      if (type !== "全部") params.set("type", type);
      const res = await fetch("/api/prepped-stock?" + params.toString());
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "加载库存失败");
      }
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setAvailableL1(json.filters?.availableL1 ?? []);
      setTotal({ totalItems: json.pagination?.totalItems ?? 0, totalPages: json.pagination?.totalPages ?? 1 });
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "加载库存失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, l1, type]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const l1Options = useMemo(() => ["全部", ...availableL1], [availableL1]);

  const start = total.totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total.totalItems);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索名称 / 编号"
            className="pl-8 w-[220px]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {l1Options.map((c) => (
            <button
              key={c}
              onClick={() => { setL1(c); setPage(1); }}
              className={
                "px-3 py-1.5 rounded-lg border text-sm transition-colors " +
                (l1 === c
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["全部", "net", "minor"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setPage(1); }}
              className={
                "px-3 py-1.5 rounded-lg border text-sm transition-colors " +
                (type === t
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {t === "全部" ? "全部" : t === "net" ? "净料" : "小料"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">共 {total.totalItems} 种</span>
      </div>

      {loading ? (
        <div className="space-y-2" aria-label="正在加载库存">
          <div className="h-10 rounded-lg bg-muted animate-pulse" />
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center">
          <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
          <p className="font-medium">库存加载失败</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchRows}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无净菜库存"
          description="库存为 0 的净菜不会显示；完成生产并确认入库后会出现在这里"
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>一级分类</TableHead>
                <TableHead>二级分类</TableHead>
                <TableHead>编号</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="text-right">库存份数</TableHead>
                <TableHead className="text-right">库存量</TableHead>
                <TableHead>最近变动</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key} className="transition-colors hover:bg-muted/40">
                  <TableCell className="font-medium bg-muted/30">{r.l1Name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.l2Name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={r.sourceType === "net" ? "净料" : "小料"}
                      variant={r.sourceType === "net" ? "info" : "neutral"}
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatPortionsCount(r.portions)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatWeight(r.qtyG)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.updatedAt).toLocaleString("zh-CN")}
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
