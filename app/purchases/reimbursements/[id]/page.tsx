"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Download, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function ReimbursementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-reimbursements/${id}`);
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "获取失败");
        return;
      }
      setData(d);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = ["采购单编号", "日期", "摘要", "负责人", "金额"];
    const rows = (data.receipts || []).map((r: any) => [
      r.id,
      new Date(r.receiptDate).toLocaleDateString("zh-CN"),
      r.summary || "",
      r.operator || "",
      Number(r.totalAmount).toFixed(2),
    ]);
    const csvContent = [
      ["报销主题", data.title],
      ["摘要", data.summary || ""],
      ["创建时间", new Date(data.createdAt).toLocaleDateString("zh-CN")],
      ["负责人", data.operator || ""],
      ["总金额", Number(data.totalAmount).toFixed(2)],
      ["状态", data.status === "settled" ? "已结算" : "待结算"],
      [],
      headers,
      ...rows,
    ]
      .map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `采购报销单-${data.id}-${data.title}.csv`;
    link.click();
    toast.success("导出成功");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-[200px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-muted-foreground">报销单不存在</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/purchases/reimbursements")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">报销单详情</h1>
            <p className="text-sm text-muted-foreground">#{data.id} · {data.title}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          导出 CSV
        </Button>
      </div>

      {/* 信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">报销主题</p>
          <p className="font-medium mt-1">{data.title}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">总金额</p>
          <p className="font-bold text-xl mt-1">¥{Number(data.totalAmount).toFixed(2)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">状态</p>
          <p className="mt-1">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                data.status === "settled"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {data.status === "settled" ? "已结算" : "待结算"}
            </span>
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">负责人</p>
          <p className="font-medium mt-1">{data.operator || "—"}</p>
        </div>
      </div>

      {data.summary && (
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">摘要</p>
          <p className="mt-1">{data.summary}</p>
        </div>
      )}

      {/* 关联采购单 */}
      <div className="space-y-3">
        <h3 className="font-medium">
          关联采购单（{data.receipts?.length || 0} 张）
        </h3>
        {(!data.receipts || data.receipts.length === 0) ? (
          <p className="text-muted-foreground text-sm">无关联采购单</p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.receipts.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">#{r.id}</TableCell>
                    <TableCell>{new Date(r.receiptDate).toLocaleDateString("zh-CN")}</TableCell>
                    <TableCell>{r.summary || "—"}</TableCell>
                    <TableCell>{r.operator || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ¥{Number(r.totalAmount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={4} className="text-right font-medium">
                    合计
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ¥{Number(data.totalAmount).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
