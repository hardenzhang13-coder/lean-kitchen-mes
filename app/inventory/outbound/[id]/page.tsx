"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import {
  Dialog, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/app/components/ui/form-controls";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  formatPortionsCount,
  getOutboundDisplayStatus,
  OUTBOUND_STATUS_LABEL,
} from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";
import { formatMoney } from "@/lib/shared/display-format";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

interface OutboundDetail {
  id: number;
  code: string;
  subjectType: "store" | "cutting_center";
  subjectName: string;
  sourceCode: string | null;
  sourceTitle: string;
  sourceDate: string;
  selfOrderId: number | null;
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
    standardPackagePrice: number | null;
    amount: number;
    prepStatus: string;
    sortIndex: number;
  }[];
}

function outboundBadge(requiredPortions: number, shippedPortions: number) {
  const status = getOutboundDisplayStatus(requiredPortions, shippedPortions);
  const variant = status === "shipped" ? "success" : status === "partial" ? "warning" : "danger";
  return <StatusBadge status={OUTBOUND_STATUS_LABEL[status]} variant={variant} />;
}

interface OutboundDetailPageProps {
  /** 嵌入大弹窗时隐藏返回按钮与页面级留白 */
  embedded?: boolean;
  /** 弹窗内没有路由参数，由调用方直接传 id */
  outboundId?: number;
}

export default function OutboundDetailPage({
  embedded = false,
  outboundId,
}: OutboundDetailPageProps = {}) {
  const router = useRouter();
  const params = useParams();
  const id = outboundId ?? Number(params?.id);

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

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => { if (id) fetchData(); }, [id, fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */


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
    return (
      <div className={embedded ? "space-y-3" : "flex flex-col gap-6 p-8"}>
        <div className="h-[400px] rounded-[12px] bg-muted animate-pulse" />
      </div>
    );
  }
  if (!data) {
    return (
      <EmptyState
        title="出库单不存在"
        description="该单据可能已被删除，或链接有误。"
        tone="danger"
        className={embedded ? "py-16" : "py-24"}
      />
    );
  }

  const voided = data.status === "voided";
  const isCuttingCenter = data.subjectType === "cutting_center";
  const sourceLabel = isCuttingCenter ? "内部生产单" : "排程单";

  return (
    <div className={embedded ? "flex flex-col gap-6" : "flex flex-col gap-6 p-8"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!embedded && (
            <SkeuButton
              variant="ghost"
              size="icon-sm"
              aria-label="返回出库单列表"
              onClick={() => router.push("/inventory?tab=outbound")}
            >
              <ArrowLeft className="h-5 w-5" />
            </SkeuButton>
          )}
          <div>
            <h1
              className={`flex items-center gap-2 font-bold tracking-tight ${
                embedded ? "text-lg" : "text-2xl"
              }`}
            >
              出库单 {data.code}
              {voided ? (
                <StatusBadge status="已作废" variant="danger" />
              ) : (
                <StatusBadge status="已出库" variant="success" />
              )}
              {!voided && (
                data.asPlanned ? (
                  <StatusBadge status="按计划出库" variant="success" />
                ) : (
                  <StatusBadge status="未按计划出库" variant="warning" />
                )
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.subjectName} · {sourceLabel} {data.sourceTitle} · 制单人 {data.operator} · {new Date(data.createdAt).toLocaleString("zh-CN")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SkeuButton variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            打印出库单
          </SkeuButton>
          {!voided && (
            <SkeuButton
              variant="danger"
              onClick={() => setVoidOpen(true)}
              disabled={actionLoading}
            >
              作废
            </SkeuButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-skeu-border bg-card p-4 shadow-sk-1">
          <div className="text-sm text-muted-foreground mb-1">
            {isCuttingCenter ? "出库主体" : "门店"}
          </div>
          <div className="font-medium">{data.subjectName}</div>
        </div>
        <div className="rounded-xl border border-skeu-border bg-card p-4 shadow-sk-1">
          <div className="text-sm text-muted-foreground mb-1">出库总份数</div>
          <div className="font-medium">{formatPortionsCount(data.totalPortions)}</div>
        </div>
        <div className="rounded-xl border border-skeu-border bg-card p-4 shadow-sk-1">
          <div className="text-sm text-muted-foreground mb-1">合计金额</div>
          <div className="font-medium text-primary">¥{data.totalAmount.toFixed(2)}</div>
        </div>
        <div className="rounded-xl border border-skeu-border bg-card p-4 shadow-sk-1">
          <div className="text-sm text-muted-foreground mb-1">未切配行</div>
          <div className="font-medium">{data.items.filter((i) => i.prepStatus === "unfinished").length}</div>
        </div>
      </div>

      <div className="skeu-table-scroll skeu-scroll overflow-auto rounded-[12px] border border-skeu-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>一级分类</TableHead>
              <TableHead>二级分类</TableHead>
              <TableHead>序号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>封装规格</TableHead>
              <TableHead className="text-right">计划出库数（份）</TableHead>
              <TableHead className="text-right">计划量</TableHead>
              <TableHead className="text-right">单价</TableHead>
              <TableHead className="text-right">本次出库数（份）</TableHead>
              <TableHead className="text-right">出库量</TableHead>
              <TableHead className="text-right">金额</TableHead>
              <TableHead>出库状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((it) => (
              <TableRow
                key={it.id}
                data-tone={
                  it.prepStatus === "unfinished"
                    ? "danger"
                    : it.prepStatus === "insufficient"
                      ? "warning"
                      : undefined
                }
              >
                <TableCell className="font-medium bg-muted/30">{it.l1Name}</TableCell>
                <TableCell className="text-muted-foreground">{it.l2Name}</TableCell>
                <TableCell className="font-mono text-xs">{String(it.sortIndex).padStart(2, "0")}</TableCell>
                <TableCell className="font-medium">{it.name}<span className="block font-mono text-xs text-muted-foreground">{it.code}</span></TableCell>
                <TableCell className="text-muted-foreground">{it.packageSpec} g/份</TableCell>
                <TableCell className="text-right font-medium">{formatPortionsCount(it.requiredPortions)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatWeight(it.requiredQty)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{formatMoney(it.standardPackagePrice, "份")}</TableCell>
                <TableCell className="text-right font-semibold">{formatPortionsCount(it.shippedPortions)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatWeight(it.shippedQty)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {it.standardPackagePrice != null ? "¥" + it.amount.toFixed(2) : "价缺失"}
                </TableCell>
                <TableCell>{outboundBadge(it.requiredPortions, it.shippedPortions)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {voided && (
        <div className="rounded-lg border border-danger/30 bg-danger-muted p-4 text-sm text-danger">
          本单已作废，{formatPortionsCount(data.totalPortions)}（¥{data.totalAmount.toFixed(2)}）已回滚至库存（见台账「作废回滚」）。
          {data.voidReason && <span className="block mt-1">作废原因：{data.voidReason} · {data.voidedAt ? new Date(data.voidedAt).toLocaleString("zh-CN") : ""}</span>}
        </div>
      )}

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
<AppDialogContent size="form">
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
            <SkeuButton variant="outline" onClick={() => setVoidOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton
              variant="danger"
              onClick={handleVoid}
              disabled={actionLoading}
            >
              确认作废并回滚库存
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </div>
  );
}
