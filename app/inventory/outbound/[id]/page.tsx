"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";

interface OutboundDetail {
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
  voidedAt: string | null;
  voidReason: string | null;
  items: {
    id: number;
    sourceType: string;
    code: string | null;
    name: string;
    l1Name: string;
    l2Name: string;
    packageSpec: number | null;
    requiredPortions: number;
    requiredQty: number;
    shippedPortions: number;
    shippedQty: number;
    pricePerJin: number | null;
    amount: number;
    prepStatus: string;
    sortIndex: number;
  }[];
}

function prepBadge(st: string) {
  if (st === "unfinished") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">未切配</span>;
  if (st === "insufficient") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">量不足</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">正常</span>;
}

export default function OutboundDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<OutboundDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/outbound-orders/" + id);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "出库单不存在");
        return;
      }
      setData(json.data as OutboundDetail);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchData(); }, [id, fetchData]);

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      toast.error("请填写作废原因");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/outbound-orders/" + id + "/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "作废失败");
        return;
      }
      toast.success("出库单已作废，库存已回滚");
      setVoidOpen(false);
      fetchData();
    } catch {
      toast.error("作废出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.open("/inventory/outbound/" + id + "/print", "_blank");
  };

  if (loading) {
    return <div className="flex flex-col gap-6 p-8"><div className="h-[400px] bg-muted rounded animate-pulse" /></div>;
  }
  if (!data) {
    return <div className="flex flex-col gap-6 p-8"><p className="text-muted-foreground">出库单不存在</p></div>;
  }

  const voided = data.status === "voided";

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push("/inventory")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              出库单 {data.code}
              {voided ? (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">已作废</span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">已出库</span>
              )}
              {!voided && (
                data.asPlanned ? (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">按计划出库</span>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">未按计划出库</span>
                )
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.storeName} · 来源排程 {data.scheduleCode}（{data.scheduleTitle}）· 生产日期 {new Date(data.scheduleDate).toLocaleDateString("zh-CN")} · 库管负责人 {data.operator} · {new Date(data.createdAt).toLocaleString("zh-CN")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            打印出库单
          </Button>
          {!voided && (
            <Button variant="destructive" onClick={() => setVoidOpen(true)} disabled={actionLoading}>
              作废
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground mb-1">门店</div>
          <div className="font-medium">{data.storeName}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground mb-1">出库总份数</div>
          <div className="font-medium">{formatPortionsCount(data.totalPortions)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground mb-1">合计金额</div>
          <div className="font-medium text-primary">¥{data.totalAmount.toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground mb-1">未切配行</div>
          <div className="font-medium">{data.items.filter((i) => i.prepStatus === "unfinished").length}</div>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>一级分类</TableHead>
              <TableHead>二级分类</TableHead>
              <TableHead>序号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>封装规格</TableHead>
              <TableHead className="text-right">计划份数</TableHead>
              <TableHead className="text-right">计划量</TableHead>
              <TableHead className="text-right">本次出库</TableHead>
              <TableHead className="text-right">出库量</TableHead>
              <TableHead className="text-right">行金额</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it) => (
              <TableRow key={it.id} className={"transition-colors hover:bg-muted/40 " + (it.prepStatus === "unfinished" ? "bg-red-50 hover:bg-red-100/60" : it.prepStatus === "insufficient" ? "bg-amber-50 hover:bg-amber-100/60" : "")}>
                <TableCell className="font-medium bg-muted/30">{it.l1Name}</TableCell>
                <TableCell className="text-muted-foreground">{it.l2Name}</TableCell>
                <TableCell className="font-mono text-xs">{String(it.sortIndex).padStart(2, "0")}</TableCell>
                <TableCell className="font-medium">{it.name}<span className="block font-mono text-[11px] text-muted-foreground">{it.code}</span></TableCell>
                <TableCell className="text-muted-foreground">{it.packageSpec} g/份</TableCell>
                <TableCell className="text-right font-medium">{formatPortionsCount(it.requiredPortions)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatWeight(it.requiredQty)}</TableCell>
                <TableCell className="text-right font-semibold">{formatPortionsCount(it.shippedPortions)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatWeight(it.shippedQty)}</TableCell>
                <TableCell className="text-right font-medium">{it.pricePerJin != null ? "¥" + it.amount.toFixed(2) : "价缺失"}</TableCell>
                <TableCell>{prepBadge(it.prepStatus)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {voided && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          本单已作废，{formatPortionsCount(data.totalPortions)}（¥{data.totalAmount.toFixed(2)}）已回滚至库存（见台账「作废回滚」）。
          {data.voidReason && <span className="block mt-1">作废原因：{data.voidReason} · {data.voidedAt ? new Date(data.voidedAt).toLocaleString("zh-CN") : ""}</span>}
        </div>
      )}

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-lg">作废出库单</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            作废后该单全部出库量将<b>回滚</b>到净菜库存（份 + g），并记录作废流水。历史单据保留可查（作废 ≠ 删除）。
          </p>
          <Textarea
            rows={3}
            placeholder="请填写作废原因（必填）"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={actionLoading} className="h-11 px-6">
              确认作废并回滚库存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}