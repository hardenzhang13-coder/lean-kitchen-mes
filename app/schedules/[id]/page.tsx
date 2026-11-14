"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Trash2,
  Pencil,
  ChefHat,
  CalendarDays,
  Clock,
  MapPin,
  FileStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";
import { ScheduleCuttingTable, type CuttingOrderRow, type ScheduleDocMeta } from "@/app/components/schedule/schedule-cutting-table";
import { SchedulePurchaseTable, type PurchasePlanRow } from "@/app/components/schedule/schedule-purchase-table";
import { ScheduleMenuTable } from "@/app/components/schedule/schedule-menu-table";
import { SalesRecordPanel } from "@/app/components/schedule/sales-record-panel";
import { SalesRecordDialog, type SalesRecordItem } from "@/app/components/schedule/sales-record-dialog";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

interface ScheduleData {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  store: { id: number; name: string } | null;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  productionPlan: {
    id: number;
    code: string | null;
    title: string;
    planDate: string;
    status: string;
  } | null;
  items: Array<{
    id: number;
    dishId: number;
    quantity: number;
    soldQty: number | null;
    soldRecordedAt: string | null;
    soldRecordedBy: string | null;
    dish: {
      id: number;
      code: string;
      name: string;
      portion: string;
      meatType: string | null;
      cost: number | null;
      price: number | null;
      category: { name: string } | null;
    };
  }>;
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  totalQuantity: number;
  dishCount: number;
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "cutting" | "purchase" | "sales">("menu");
  const [recordOpen, setRecordOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/schedules/${id}`);
        const d = await parseObject<ScheduleData>(res);
        if (!d) {
          if (alive) toast.error("排程不存在");
          return;
        }
        if (!alive) return;
        setData(d);
      } catch {
        if (alive) toast.error("获取排程数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchData();
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}/activate`, { method: "PUT" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return;
      }
      toast.success("生产计划已确认");
      setActivateOpen(false);
      refresh();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "删除失败");
        return;
      }
      toast.success("排程已删除");
      setDeleteOpen(false);
      router.push("/schedules");
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
        <p className="text-muted-foreground">排程不存在</p>
      </div>
    );
  }

  const docMeta: ScheduleDocMeta = {
    title: data.title,
    scheduleDate: data.scheduleDate,
    storeName: data.store?.name ?? "",
    scheduleId: data.id,
    code: data.code,
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回排程列表" onClick={() => router.push("/schedules")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              {data.code ?? `排程 #${data.id}`} · 制单人：{data.operatorName || data.operator || "—"} <StatusBadge status={data.status} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === "待生效" && (
            <>
              <Button variant="outline" onClick={() => router.push(`/schedules/${id}/edit`)} disabled={actionLoading}>
                <Pencil className="mr-2 h-4 w-4" />
                修改
              </Button>
              <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={actionLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
              <Button onClick={() => setActivateOpen(true)} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                确认生产计划
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 基础信息块 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CalendarDays className="h-4 w-4" />
            生产日期
          </div>
          <div className="font-medium">
            {new Date(data.scheduleDate).toLocaleDateString("zh-CN")}
          </div>
          <div className="text-sm text-muted-foreground">{getWeekDay(data.scheduleDate)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            门店
          </div>
          <div className="font-medium">{data.store?.name ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            制单信息
          </div>
          <div className="font-medium">{data.operatorName || data.operator || "—"}</div>
          <div className="text-sm text-muted-foreground">
            {new Date(data.createdAt).toLocaleString("zh-CN")}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ChefHat className="h-4 w-4" />
            菜品统计
          </div>
          <div className="font-medium">{data.dishCount} 个菜品 / {data.totalQuantity} 份</div>
        </div>
      </div>

      {data.productionPlan && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <FileStack className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            已纳入生产计划单{" "}
            <span className="font-mono text-xs">{data.productionPlan.code ?? `PPL-${data.productionPlan.id}`}</span>
            {" · "}
            {data.productionPlan.title}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/production-plans/${data.productionPlan?.id}`)}
          >
            查看生产计划
          </Button>
        </div>
      )}
      {!data.productionPlan && data.status === "进行中" && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <FileStack className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">
            本排程尚未纳入生产计划单，可前往生产计划单选择汇总。
          </span>
          <Button size="sm" variant="outline" onClick={() => router.push("/production-plans/new")}>
            新增生产计划单
          </Button>
        </div>
      )}

      {/* 待回录提醒横幅（未全部回录时显示） */}
      {data.status !== "待生效" && data.items.some((it) => it.soldQty == null) && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] px-4 py-3 text-sm">
          <span>⚠️</span>
          <span className="flex-1 text-[var(--status-warning)]">
            <b className="text-foreground">
              本排程尚未{data.items.every((it) => it.soldQty == null) ? "" : "完成"}回录销售数据
            </b>
            {" "}· 回录后此处展示售出复盘
          </span>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            去回录 →
          </Button>
        </div>
      )}
      {/* 核心数据：Tab 切换 */}
      <div>
        <div className="flex items-center gap-1 border-b">
          {([
            ["menu", "排程菜单", data.items.length],
            ["cutting", "切配工单明细", data.cuttingOrders.length],
            ["purchase", "采购计划明细", data.purchasePlans.length],
            ...(data.status !== "待生效" ? [["sales", "销售回录", 0] as const] : []),
          ] as const).map(([key, label, count]) => (
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
                            {label}
              {count > 0 && (
                <span
                  className={
                    "ml-1.5 text-xs rounded-full px-1.5 py-0.5 " +
                    (activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                  }
                >
                  {count}
                </span>
              )}
              {key === "sales" && data.items.some((it) => it.soldQty == null) && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
              )}

            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeTab === "menu" &&
            (data.items.length > 0 ? (
              <ScheduleMenuTable items={data.items} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无菜单数据</p>
            ))}
          {activeTab === "cutting" &&
            (data.cuttingOrders.length > 0 ? (
              <ScheduleCuttingTable rows={data.cuttingOrders} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无切配工单</p>
            ))}
          {activeTab === "sales" && (
            <SalesRecordPanel items={data.items} onOpenRecord={() => setRecordOpen(true)} />
          )}
          {activeTab === "purchase" &&

            (data.purchasePlans.length > 0 ? (
              <SchedulePurchaseTable rows={data.purchasePlans} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无采购计划</p>
            ))}
        </div>
      </div>

      {/* 销售回录弹窗 */}
      <SalesRecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        scheduleId={data.id}
        scheduleCode={data.code}
        items={data.items as SalesRecordItem[]}
        onSaved={refresh}
      />

      {/* 删除二次确认 */}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
<AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条排程吗？切配工单与采购计划将一并删除，此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} className="h-11 px-6">
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
<AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认生产计划</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确认后排程单将进入「进行中」，菜品、数量、门店和生产日期不可再修改，也不能删除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleActivate} disabled={actionLoading} className="h-11 px-6">
              确认并进入生产
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </div>
  );
}
