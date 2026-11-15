"use client";

import { useEffect, useState, startTransition } from "react";
import { Plus, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DatePicker } from "@/app/components/ui/date-picker";
import { EmptyState } from "@/app/components/ui/empty-state";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { CompleteProductionDialog } from "@/app/components/production-plan/complete-production-dialog";
import { ProductionPlanStoreSchedules } from "@/app/components/production-plan/store-schedules-tab";
import { ScheduleCuttingTable } from "@/app/components/schedule/schedule-cutting-table";
import { SchedulePurchaseTable } from "@/app/components/schedule/schedule-purchase-table";
import { ProductionPlanCard } from "@/app/components/schedule/production-plan-card";
import { ProductionPlanCreateDialog } from "@/app/components/production-plan/production-plan-create-dialog";
import { KanbanBoard } from "@/app/components/schedule/kanban-board";
import { useProductionPlanBoard } from "@/app/components/schedule/use-schedule-board";
import type {
  CuttingOrderRow,
  PlanPreviewTab,
  ProductionPlanPreview,
  ScheduleDocMeta,
} from "@/app/components/schedule/list-types";
import type { PlanCuttingRow } from "@/lib/shared/prepped-stock";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

function toPlanCuttingRows(rows: CuttingOrderRow[]): PlanCuttingRow[] {
  return rows.map((row) => ({
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceCode: row.sourceCode ?? "",
    itemName: row.itemName,
    l1Name: row.l1Name,
    l2Name: row.l2Name,
    packageSpec: row.packageSpec,
    requiredQty: row.requiredQty,
    unit: row.unit,
    portions: row.portions,
    portionsText: row.portionsText,
    grossNeedJin: row.grossNeedJin,
    confirmStatus: row.confirmStatus,
    actualPortions: row.actualPortions,
    remark: row.remark,
  }));
}

export default function ProductionPlansPage() {
  const router = useRouter();
  const board = useProductionPlanBoard();
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/production-plans", "POST", role);

  const [actionId, setActionId] = useState<number | null>(null);
  const [createState, setCreateState] = useState<{
    presetScheduleId: number | null;
  } | null>(null);
  const [preview, setPreview] = useState<ProductionPlanPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<PlanPreviewTab>("cutting");
  const [completeTarget, setCompleteTarget] = useState<{
    planId: number;
    rows: PlanCuttingRow[];
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scheduleId = Number(params.get("scheduleId"));
    // 以 transition 更新，避免该 effect 同步触发级联渲染
    startTransition(() => {
      if (Number.isInteger(scheduleId) && scheduleId > 0) {
        setCreateState({ presetScheduleId: scheduleId });
      } else if (params.get("create") === "1") {
        setCreateState({ presetScheduleId: null });
      }
    });
  }, []);

  const openPreview = async (id: number) => {
    setPreviewLoading(true);
    setPreviewTab("cutting");
    try {
      const res = await fetch("/api/production-plans/" + id);
      const data = await parseObject<ProductionPlanPreview>(res);
      if (!data) {
        toast.error("生产计划单不存在");
        return;
      }
      setPreview(data);
    } catch {
      toast.error("获取生产计划单失败");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreview(null);
    setPreviewLoading(false);
  };

  const activatePlan = async (id: number) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/production-plans/${id}/activate`, { method: "PUT" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success("生产计划已确认，进入进行中");
      board.refresh();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionId(null);
    }
  };

  const openCompleteDialog = async (planId: number) => {
    setActionId(planId);
    try {
      const res = await fetch(`/api/production-plans/${planId}`);
      const data = await parseObject<ProductionPlanPreview>(res);
      if (!data) {
        toast.error("生产计划单不存在");
        return;
      }
      setCompleteTarget({ planId, rows: toPlanCuttingRows(data.cuttingOrders) });
    } catch {
      toast.error("获取生产计划单失败");
    } finally {
      setActionId(null);
    }
  };

  const printLabels = (planId: number) => {
    window.open(
      `/production-plans/${planId}/labels`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const previewMeta: ScheduleDocMeta | null = preview
    ? {
        title: preview.title,
        scheduleDate: preview.planDate,
        storeName: "",
        scheduleId: preview.id,
        code: preview.code,
        printBase: "/production-plans/",
      }
    : null;

  return (
    <PageShell>
      <PageHeader
        title="生产计划单"
        description="把各门店「进行中」的排程单汇总成一张执行单；切配完成后逐行确认并入库"
        actions={
          canWrite ? (
            <Button onClick={() => setCreateState({ presetScheduleId: null })}>
              <Plus className="mr-2 h-4 w-4" />
              生产计划
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        searchValue={board.search}
        onSearchChange={board.setSearch}
        searchPlaceholder="搜索生产计划单标题..."
        onReset={board.reset}
        hasFilters={!!board.date}
      >
        <DatePicker
          value={board.date}
          onChange={board.setDate}
          placeholder="生产日期"
          className="w-[190px]"
          showWeekday
        />
      </ListToolbar>

      {board.loading && board.columns.length === 0 ? (
        <LoadingState type="card-grid" rows={3} />
      ) : (
        <KanbanBoard
          columns={board.columns}
          loading={board.loading}
          emptyText="暂无生产计划单"
          renderItem={(row) => (
            <ProductionPlanCard
              key={row.id}
              item={row}
              busy={actionId === row.id}
              canWrite={canWrite}
              onOpen={() => openPreview(row.id)}
              onActivate={() => activatePlan(row.id)}
              onComplete={() => openCompleteDialog(row.id)}
            />
          )}
        />
      )}

      <Dialog
        open={previewLoading || !!preview}
        onOpenChange={(open) => !open && closePreview()}
      >
        <AppDialogContent
          size="workbench"
          className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
        >
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-lg">
              {preview?.title ?? "生产计划单预览"}
            </DialogTitle>
            {preview && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <ScheduleStatusTag status={preview.status} size="sm" />
                <span>
                  {formatDate(preview.planDate)} {getWeekDay(preview.planDate)}
                </span>
                <span>汇总 {preview.sourceSchedules.length} 张排程单</span>
              </div>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {previewLoading || !preview || !previewMeta ? (
              <LoadingState type="page" />
            ) : (
              <>
                <SectionTabs
                  ariaLabel="生产计划单预览内容"
                  value={previewTab}
                  onChange={setPreviewTab}
                  tabs={[
                    { value: "cutting", label: "切配汇总", count: preview.cuttingOrders.length },
                    { value: "purchase", label: "采购汇总", count: preview.purchasePlans.length },
                    { value: "stores", label: "门店排程", count: preview.sourceSchedules.length },
                  ]}
                />
                <div className="pt-4">
                  {previewTab === "cutting" && (
                    <ScheduleCuttingTable
                      rows={preview.cuttingOrders}
                      meta={previewMeta}
                      enableLabelPrint
                    />
                  )}
                  {previewTab === "purchase" && (
                    <SchedulePurchaseTable rows={preview.purchasePlans} meta={previewMeta} />
                  )}
                  {previewTab === "stores" &&
                    (preview.sourceSnapshot ? (
                      <ProductionPlanStoreSchedules
                        snapshot={preview.sourceSnapshot}
                        sourceSchedules={preview.sourceSchedules.map((schedule) => ({
                          id: schedule.id,
                          status: schedule.status ?? "—",
                        }))}
                      />
                    ) : (
                      <EmptyState
                        icon={CalendarDays}
                        title="没有来源排程数据"
                        description="历史计划单未固化来源快照，请到详情页查看。"
                      />
                    ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t px-6 pb-5 pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => preview && printLabels(preview.id)}
                disabled={!preview || preview.cuttingOrders.length === 0}
              >
                打印净菜标签
              </Button>
              <Button
                onClick={() =>
                  preview && router.push(`/production-plans/${preview.id}`)
                }
                disabled={!preview}
              >
                查看完整详情
              </Button>
            </div>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <CompleteProductionDialog
        open={!!completeTarget}
        onOpenChange={(open) => {
          if (!open) setCompleteTarget(null);
        }}
        planId={completeTarget?.planId ?? 0}
        rows={completeTarget?.rows ?? []}
        onCompleted={() => board.refresh()}
      />

      {createState && (
        <ProductionPlanCreateDialog
          presetScheduleId={createState.presetScheduleId}
          onClose={() => setCreateState(null)}
          onCreated={(id) => {
            setCreateState(null);
            board.refresh();
            if (id) router.push(`/production-plans/${id}`);
          }}
        />
      )}
    </PageShell>
  );
}
