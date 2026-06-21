"use client";

import { useEffect, useState } from "react";
import { Package, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

interface InventoryItem {
  id: number;
  sourceId: number;
  name: string;
  code: string;
  l2Code?: string;
  l1Name?: string;
  l2Name?: string;
  currentQty: number;
  unit: string;
  updatedAt: string;
}

export default function InventoryPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l2Filter, setL2Filter] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      setRows(data);
    } catch {
      toast.error("获取库存数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 提取所有二级分类
  const l2Categories = Array.from(
    new Map(
      rows
        .filter((r) => r.l2Name)
        .map((r) => [r.l2Name, r.l2Code])
    ).entries()
  ).map(([name, code]) => ({ name, code }));

  const filtered = rows.filter((r) => {
    const matchSearch = !search
      ? true
      : r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.l2Name?.toLowerCase().includes(search.toLowerCase()) ||
        r.l1Name?.toLowerCase().includes(search.toLowerCase());
    const matchL2 = !l2Filter ? true : r.l2Code === l2Filter;
    return matchSearch && matchL2;
  });

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：标题 + 二级菜单 */}
      <div className="flex items-center justify-between">
        <PageHeader
          showBack
          title="库存管理"
          description="实时库存查询与管理"
        />
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-background shadow-sm">
            实时库存
          </button>
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push("/inventory/ledger")}
          >
            库存台账
          </button>
        </div>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索食材名称、编码或分类..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={l2Filter} onValueChange={(v) => v && setL2Filter(v)}>
              <SelectTrigger className="w-[180px] h-10">
                <SelectValue placeholder="全部二级分类" />
              </SelectTrigger>
              <SelectContent>
                {l2Categories.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || l2Filter) && (
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setL2Filter("");
                }}
              >
                清除
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂无库存数据</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>食材名称</TableHead>
                    <TableHead>一级分类</TableHead>
                    <TableHead>二级分类</TableHead>
                    <TableHead>当前库存量</TableHead>
                    <TableHead>计量单位</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell>
                        {row.l1Name ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--info-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--info)]">
                            {row.l1Name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {row.l2Name ? (
                          <span className="inline-flex items-center rounded-full bg-[var(--success-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
                            {row.l2Name}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {Number(row.currentQty).toFixed(2)}
                      </TableCell>
                      <TableCell>{row.unit}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
