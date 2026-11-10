"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/app/components/ui/pagination";
import { EmptyState } from "@/app/components/ui/empty-state";
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
}

/** 当前库存 Tab：库存份数 + 库存量(g) 双字段，无汇总 KPI */
export function StockTab() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [l1, setL1] = useState("全部");
  const [type, setType] = useState<"全部" | "net" | "minor">("全部");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState({ totalItems: 0, totalPages: 1 });

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (l1 !== "全部") params.set("l1", l1);
      if (type !== "全部") params.set("type", type);
      const res = await fetch("/api/prepped-stock?" + params.toString());
      const json = (await res.json()) as PageData;
      setRows(json.data ?? []);
      setTotal({ totalItems: json.pagination?.totalItems ?? 0, totalPages: json.pagination?.totalPages ?? 1 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, l1, type]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const l1Options = useMemo(() => ["全部", ...Array.from(new Set(rows.map((r) => r.l1Name)))], [rows]);

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
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="暂无净菜库存"
          description="完成生产后，净菜会自动入库显示在这里"
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
                    <span className={"inline-block px-2 py-0.5 rounded-full text-xs font-medium " + (r.sourceType === "net" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                      {r.sourceType === "net" ? "净料" : "小料"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatPortionsCount(r.portions)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatWeight(r.qtyG)}</TableCell>
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