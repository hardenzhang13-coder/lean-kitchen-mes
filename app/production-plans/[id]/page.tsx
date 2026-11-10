"use client";

import { CompleteProductionDialog } from "@/app/components/production-plan/complete-production-dialog";
import { rowConfirmStatus, formatPortionsCount, type PlanCuttingRow } from "@/lib/shared/prepped-stock";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Play, CheckCircle2, Trash2, CalendarDays, Clock, ChefHat, FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  ScheduleCuttingTable, type CuttingOrderRow, type ScheduleDocMeta,
} from "@/app/components/schedule/schedule-cutting-table";
import {
  SchedulePurchaseTable, type PurchasePlanRow,
} from "@/app/components/schedule/schedule-purchase-table";

interface SourceSchedule {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  totalQuantity: number;
}

interface PlanDetail {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
  operator: string | null;
  operatorName: string | null;
  createdAt: string;
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  sourceSchedules: SourceSchedule[];
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function ProductionPlanDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cutting" | "purchase">("cutting");
  const [completeOpen, setCompleteOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/production-plans/" + id);
      const d = await parseObject<PlanDetail>(res);
      if (!d) {
        toast.error("生产计划单不存在");
        return;
      }
      setData(d);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const doAction = async (url: string, successMsg: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(url, { method: "PUT" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return;
      }
      toast.success(successMsg);
      fetchData();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/production-plans/" + id, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "删除失败");
        return;
      }
      toast.success("生产计划单已删除");
      setDeleteOpen(false);
      router.push("/schedules?tab=plans");
    } catch {
      toast.error("删除出错");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-[200px] bg-muted rounded animate-pulse" />
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-muted-foreground">生产计划单不存在</p>
      </div>
    );
  }

  const docMeta: ScheduleDocMeta = {
    title: data.title,
    scheduleDate: data.planDate,
    storeName: "",
    scheduleId: data.id,
    code: data.code,
    printBase: "/production-plans/",
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push("/schedules?tab=plans")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {data.code ?? "生产计划 #" + data.id} · 制单人：{data.operatorName || data.operator || "—"} <StatusBadge status={data.status} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === "待生效" && (
            <>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={actionLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
              <Button onClick={() => doAction("/api/production-plans/" + id + "/activate", "生产计划已确认")} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                确认生产计划
              </Button>
            </>
          )}
          {data.status === "进行中" && (
            <Button onClick={() => setCompleteOpen(true)} disabled={actionLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              完成生产
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><CalendarDays className="h-4 w-4" />生产日期</div>
          <div className="font-medium">{new Date(data.planDate).toLocaleDateString("zh-CN")}</div>
          <div className="text-sm text-muted-foreground">{getWeekDay(data.planDate)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="h-4 w-4" />制单信息</div>
          <div className="font-medium">{data.operatorName || data.operator || "—"}</div>
          <div className="text-sm text-muted-foreground">{new Date(data.createdAt).toLocaleString("zh-CN")}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><FileStack className="h-4 w-4" />汇总排程单</div>
          <div className="font-medium">{data.sourceSchedules.length} 张</div>
          <div className="text-sm text-muted-foreground truncate">
            {data.sourceSchedules.map((s) => s.code ?? "#" + s.id).join("、")}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><ChefHat className="h-4 w-4" />计划份数合计</div>
          <div className="font-medium">{data.sourceSchedules.reduce((s, x) => s + x.totalQuantity, 0)} 份</div>
          <div className="text-sm text-muted-foreground">
            切配 {data.cuttingOrders.length} 项 / 采购 {data.purchasePlans.length} 项
          </div>
        </div>
      </div>

      {/* 切配确认进度（净菜入库口径，v002） */}
      {(() => {
        const rows = data.cuttingOrders as unknown as PlanCuttingRow[];
        if (!rows.length) return null;
        const done = rows.filter((r) => rowConfirmStatus(r) === "completed").length;
        const undone = rows.filter((r) => rowConfirmStatus(r) === "unfinished").length;
        const pending = rows.length - done - undone;
        if (done + undone === 0 && data.status === "待生效") return null;
        return (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">切配确认进度</h3>
              <span className="text-xs text-muted-foreground">
                {done} 完成 · {undone} 未完成 · {pending} 待确认
              </span>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left">
                    <th className="px-3 py-2 font-medium">编号</th>
                    <th className="px-3 py-2 font-medium">名称</th>
                    <th className="px-3 py-2 font-medium text-right">计划份数</th>
                    <th className="px-3 py-2 font-medium">完成状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const st = rowConfirmStatus(r);
                    return (
                      <tr key={`${r.sourceType}:${r.sourceId}`} className={"border-t transition-colors hover:bg-muted/40 " + (st === "unfinished" ? "bg-red-50" : "")}>
                        <td className="px-3 py-2 font-mono text-xs">{r.sourceCode}</td>
                        <td className="px-3 py-2 font-medium">{r.itemName}</td>
                        <td className="px-3 py-2 text-right">{formatPortionsCount(r.portions ?? 0)}</td>
                        <td className="px-3 py-2">
                          {st === "pending" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">待切配</span>
                          ) : st === "completed" ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">已完成 · 实切 {formatPortionsCount(r.actualPortions ?? 0)}</span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600" title={r.remark ?? ""}>
                              未完成{r.remark ? ` · ${r.remark}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <div>
        <div className="flex items-center gap-1 border-b">
          {(["cutting", "purchase"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {key === "cutting" ? "切配工单明细" : "采购计划明细"}
              <span className={"ml-1.5 text-xs rounded-full px-1.5 py-0.5 " + (activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                {key === "cutting" ? data.cuttingOrders.length : data.purchasePlans.length}
              </span>
            </button>
          ))}
        </div>
        <div className="pt-4">
          {activeTab === "cutting" && <ScheduleCuttingTable rows={data.cuttingOrders} meta={docMeta} />}
          {activeTab === "purchase" && <SchedulePurchaseTable rows={data.purchasePlans} meta={docMeta} />}
        </div>
      </div>

      <CompleteProductionDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        planId={id}
        rows={data.cuttingOrders as unknown as PlanCuttingRow[]}
        onCompleted={fetchData}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">确定要删除这条生产计划单吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
