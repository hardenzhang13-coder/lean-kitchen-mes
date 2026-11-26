"use client";

import { CompleteProductionDialog } from "@/app/components/production-plan/complete-production-dialog";
import { ProductionPlanCreateDialog } from "@/app/components/production-plan/production-plan-create-dialog";
import { ProductionPlanStoreSchedules } from "@/app/components/production-plan/store-schedules-tab";
import { ProductionPlanSelfProduction } from "@/app/components/production-plan/self-production-tab";
import { rowConfirmStatus, type PlanCuttingRow } from "@/lib/shared/prepped-stock";
import type { ProductionPlanSourceSnapshot } from "@/lib/shared/production-plan";
import { getWeekDay } from "@/lib/shared/date-format";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Ban,
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
import { PageTabs } from "@/app/components/ui/page-tabs";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { SkeuButton } from "@/app/components/ui/skeu-button";
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

interface SelfOrderSummary {
  id: number;
  code: string | null;
  title: string;
  produceDate: string;
  status: string;
  remark: string | null;
  totalPortions: number;
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
  selfOrders: SelfOrderSummary[];
  sourceSnapshot: ProductionPlanSourceSnapshot;
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
  const [activeTab, setActiveTab] = useState<"cutting" | "purchase" | "stores" | "self">("cutting");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/production-plans/" + id);
      const d = await parseObject<PlanDetail>(res);
      if (!d) {
        toast.error("切配计划单不存在");
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
      "切配计划已确认"
    );
    if (success) setActivateOpen(false);
  };

  const handleVoid = async () => {
    const success = await doAction(
      "/api/production-plans/" + id + "/void",
      "切配计划单已作废，回退到待生效"
    );
    if (success) setVoidOpen(false);
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
      toast.success("切配计划单已删除");
      setDeleteOpen(false);
      router.push("/production-plans");
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
          title="切配计划单不存在"
          description="该计划单可能已删除，或当前链接已失效。"
          action={{
            label: "返回切配计划单列表",
            onClick: () => router.push("/production-plans"),
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
        backHref="/production-plans"
        backLabel="返回切配计划单列表"
        title={data.title}
        meta={<ScheduleStatusTag status={data.status} />}
        description={
          <>
            {data.code ?? "切配计划 #" + data.id} · 制单人：
            {data.operatorName || data.operator || "—"}
          </>
        }
        actions={
          <>
            <SkeuButton
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
                  : "打印本切配计划单的全部净菜标签"
              }
            >
              <Tags className="mr-2 h-4 w-4" />
              打印净菜标签
            </SkeuButton>
            {data.status === "待生效" && (
              <>
                <SkeuButton
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  disabled={actionLoading}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  修改
                </SkeuButton>
                <SkeuButton
                  variant="danger"
                  onClick={() => setDeleteOpen(true)}
                  disabled={actionLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </SkeuButton>
                <SkeuButton onClick={() => setActivateOpen(true)} disabled={actionLoading}>
                  <Play className="mr-2 h-4 w-4" />
                  确认切配计划
                </SkeuButton>
              </>
            )}
            {data.status === "已完成" && (
              <SkeuButton
                variant="danger"
                onClick={() => setDeleteOpen(true)}
                disabled={actionLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </SkeuButton>
            )}
            {data.status === "进行中" && (
              <>
                <SkeuButton onClick={() => setCompleteOpen(true)} disabled={actionLoading}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  完成切配
                </SkeuButton>
                <SkeuButton
                  variant="ghost"
                  className="text-[#b42318] hover:bg-[#fdecea] hover:text-[#b42318]"
                  onClick={() => setVoidOpen(true)}
                  disabled={actionLoading}
                >
                  <Ban className="h-4 w-4" />
                  作废
                </SkeuButton>
              </>
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
          label="汇总来源"
          value={`${data.sourceSchedules.length} 张排程 · ${data.selfOrders.length} 张内部生产`}
          helper={
            [
              ...data.sourceSchedules.map((s) => s.code ?? "#" + s.id),
              ...data.selfOrders.map((o) => o.code ?? "#" + o.id),
            ].join("、") || "—"
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
        <PageTabs
          ariaLabel="切配计划单内容"
          value={activeTab}
          onChange={(value) => setActiveTab(value as "cutting" | "purchase" | "stores" | "self")}
          tabs={[
            { value: "cutting", label: "切配工单明细", count: data.cuttingOrders.length },
            { value: "purchase", label: "采购计划明细", count: data.purchasePlans.length },
            { value: "stores", label: "门店排程", count: data.sourceSchedules.length },
            { value: "self", label: "内部生产", count: data.selfOrders.length },
          ]}
        />
        <div className="min-w-0 pt-4">
          {activeTab === "cutting" && (
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-4 py-3 text-sm shadow-sk-raised">
                <span className="text-muted-foreground">
                  已完成 <b className="text-foreground">{completedCount}</b> 项
                </span>
                <span className="text-muted-foreground">
                  未完成 <b className="text-foreground">{unfinishedCount}</b> 项
                </span>
                <span className="text-muted-foreground">
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
          {activeTab === "self" && (
            <ProductionPlanSelfProduction
              snapshot={data.sourceSnapshot}
              selfOrders={data.selfOrders}
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

      {editOpen && (
        <ProductionPlanCreateDialog
          editId={id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            fetchData();
          }}
        />
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            {data.status === "已完成"
              ? "确定要删除这条已完成的切配计划单吗？删除不影响已入库的净菜库存、批次与库存流水，此操作不可撤销。"
              : "确定要删除这条切配计划单吗？删除后来源排程单可重新纳入其他切配计划单，此操作不可撤销。"}
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton variant="danger" onClick={handleDelete} disabled={actionLoading}>
              删除
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认切配计划</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            确认后切配计划单进入「进行中」，标题、日期和来源排程单不可再修改，也不能删除。
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setActivateOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton onClick={handleActivate} disabled={actionLoading}>
              确认并进入切配
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">作废切配计划单</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            作废后计划单回退到「待生效」，可重新编辑切配量与来源排程；
            已有切配完成记录（净菜已入库）时不能作废。
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setVoidOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton variant="danger" onClick={handleVoid} disabled={actionLoading}>
              确认作废
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
