"use client";

import { CompleteProductionDialog } from "@/app/components/production-plan/complete-production-dialog";
import { ProductionPlanStoreSchedules } from "@/app/components/production-plan/store-schedules-tab";
import { rowConfirmStatus, type PlanCuttingRow } from "@/lib/shared/prepped-stock";
import type { ProductionPlanSourceSnapshot } from "@/lib/shared/production-plan";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Play,
  CheckCircle2,
  Trash2,
  CalendarDays,
  Clock,
  ChefHat,
  FileStack,
  Pencil,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { InfoTile } from "@/app/components/ui/info-tile";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SectionTabs } from "@/app/components/ui/section-tabs";
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
  status: string;
  store: { id: number; name: string };
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
  sourceSnapshot: ProductionPlanSourceSnapshot;
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
  const [activateOpen, setActivateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cutting" | "purchase" | "stores">("cutting");
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

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- 数据获取 effect：React 官方推荐模式；fetchData 仅依赖 id，已在依赖数组中声明。 */
  useEffect(() => {
    if (id) fetchData();
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */


  const doAction = async (url: string, successMsg: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const res = await fetch(url, { method: "PUT" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return false;
      }
      toast.success(successMsg);
      fetchData();
      return true;
    } catch {
      toast.error("操作出错");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    const success = await doAction(
      "/api/production-plans/" + id + "/activate",
      "生产计划已确认"
    );
    if (success) setActivateOpen(false);
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
      <PageShell>
        <LoadingState type="page" />
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell>
        <EmptyState
          icon={FileStack}
          title="生产计划单不存在"
          description="该计划单可能已删除，或当前链接已失效。"
          action={{
            label: "返回生产计划单列表",
            onClick: () => router.push("/schedules?tab=plans"),
          }}
        />
      </PageShell>
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
  const cuttingRows = data.cuttingOrders as PlanCuttingRow[];
  const completedCount = cuttingRows.filter(
    (row) => rowConfirmStatus(row) === "completed"
  ).length;
  const unfinishedCount = cuttingRows.filter(
    (row) => rowConfirmStatus(row) === "unfinished"
  ).length;
  const pendingCount = cuttingRows.length - completedCount - unfinishedCount;

  return (
    <PageShell>
      <PageHeader
        showBack
        backHref="/schedules?tab=plans"
        backLabel="返回生产计划单列表"
        title={data.title}
        meta={<StatusBadge status={data.status} />}
        description={
          <>
            {data.code ?? "生产计划 #" + data.id} · 制单人：
            {data.operatorName || data.operator || "—"}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  `/production-plans/${id}/labels`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              disabled={data.cuttingOrders.length === 0}
              title={
                data.cuttingOrders.length === 0
                  ? "当前计划单没有净菜标签"
                  : "打印本生产计划单的全部净菜标签"
              }
            >
              <Tags className="mr-2 h-4 w-4" />
              打印净菜标签
            </Button>
            {data.status === "待生效" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/production-plans/${id}/edit`)}
                  disabled={actionLoading}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  修改
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={actionLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
                <Button onClick={() => setActivateOpen(true)} disabled={actionLoading}>
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
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoTile
          icon={CalendarDays}
          label="生产日期"
          value={new Date(data.planDate).toLocaleDateString("zh-CN")}
          helper={getWeekDay(data.planDate)}
        />
        <InfoTile
          icon={Clock}
          label="制单信息"
          value={data.operatorName || data.operator || "—"}
          helper={new Date(data.createdAt).toLocaleString("zh-CN")}
        />
        <InfoTile
          icon={FileStack}
          label="汇总排程单"
          value={`${data.sourceSchedules.length} 张`}
          helper={
            data.sourceSchedules.map((s) => s.code ?? "#" + s.id).join("、") ||
            "—"
          }
        />
        <InfoTile
          icon={ChefHat}
          label="计划份数合计"
          value={`${data.sourceSchedules.reduce((s, x) => s + x.totalQuantity, 0)} 份`}
          helper={`切配 ${data.cuttingOrders.length} 项 / 采购 ${data.purchasePlans.length} 项`}
        />
      </div>

      <div className="min-w-0">
        <SectionTabs
          ariaLabel="生产计划单内容"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "cutting", label: "切配工单明细", count: data.cuttingOrders.length },
            { value: "purchase", label: "采购计划明细", count: data.purchasePlans.length },
            { value: "stores", label: "门店排程", count: data.sourceSchedules.length },
          ]}
        />
        <div className="min-w-0 pt-4">
          {activeTab === "cutting" && (
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  已完成 <b className="text-foreground">{completedCount}</b> 项
                </span>
                <span>
                  未完成 <b className="text-foreground">{unfinishedCount}</b> 项
                </span>
                <span>
                  待确认 <b className="text-foreground">{pendingCount}</b> 项
                </span>
              </div>
              <ScheduleCuttingTable
                rows={data.cuttingOrders}
                meta={docMeta}
                showConfirmColumns
                enableLabelPrint
              />
            </div>
          )}
          {activeTab === "purchase" && <SchedulePurchaseTable rows={data.purchasePlans} meta={docMeta} />}
          {activeTab === "stores" && (
            <ProductionPlanStoreSchedules
              snapshot={data.sourceSnapshot}
              sourceSchedules={data.sourceSchedules}
            />
          )}
        </div>
      </div>

      <CompleteProductionDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        planId={id}
        rows={cuttingRows}
        onCompleted={fetchData}
      />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条生产计划单吗？删除后来源排程可重新纳入其他生产计划单，此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AppDialogContent size="form">
          <DialogHeader>
            <DialogTitle className="text-lg">确认生产计划</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确认后生产计划单将进入「进行中」，标题、日期和来源排程不可再修改，也不能删除。
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
    </PageShell>
  );
}
