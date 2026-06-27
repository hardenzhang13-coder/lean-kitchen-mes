"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, Search, FileText, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

export default function ReimbursementsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase-reimbursements");
      const data = await res.json();
      setRows(data.data?.items || data.data || []);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(s) ||
      (r.summary && r.summary.toLowerCase().includes(s)) ||
      String(r.id).includes(s)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：标题 + 二级菜单 + 操作按钮 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="采购报销"
          description="管理采购报销与结算"
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => router.push("/purchases")}
            >
              采购单
            </button>
            <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-background shadow-sm">
              采购报销
            </button>
          </div>
          <Button onClick={() => router.push("/purchases/reimbursements/new")}>
            <Plus className="mr-2 h-4 w-4" />
            创建报销
          </Button>
        </div>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索报销主题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                清除
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂无报销单</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/purchases/reimbursements/new")}
              >
                创建第一单
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>报销主题</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>关联采购单</TableHead>
                    <TableHead>总金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() =>
                        router.push(`/purchases/reimbursements/${r.id}`)
                      }
                    >
                      <TableCell className="font-medium">#{r.id}</TableCell>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{r.summary || "—"}</TableCell>
                      <TableCell>{r.receiptIds?.length || 0} 张</TableCell>
                      <TableCell className="font-semibold">
                        ¥{Number(r.totalAmount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status === "settled" ? "已结算" : "待结算"} />
                      </TableCell>
                      <TableCell>{r.operatorName || r.operator || "—"}</TableCell>
                      <TableCell>
                        {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="查看报销详情"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/purchases/reimbursements/${r.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
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
