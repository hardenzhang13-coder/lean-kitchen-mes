"use client";

import { useEffect, useState, startTransition } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { DatePicker } from "@/app/components/ui/date-picker";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { CompleteProductionDialog } from "@/app/components/production-plan/complete-production-dialog";
import { ProductionPlanCreateDialog } from "@/app/components/production-plan/production-plan-create-dialog";
import { ProductionPlanCard } from "@/app/components/schedule/production-plan-card";
import { KanbanBoard } from "@/app/components/schedule/kanban-board";
import { StatusColumnMenu } from "@/app/components/schedule/status-column-menu";
import { useProductionPlanBoard } from "@/app/components/schedule/use-schedule-board";
import { useStatusVisibility } from "@/app/components/schedule/use-status-visibility";
import type {
  CuttingOrderRow,
  ProductionPlanPreview,
} from "@/app/components/schedule/list-types";
import type { PlanCuttingRow } from "@/lib/shared/prepped-stock";
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
  const { visible: visibleStatuses, setStatuses } = useStatusVisibility(
    "lean-kms:production-plans:visible-statuses"
  );
  const board = useProductionPlanBoard(visibleStatuses);
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/production-plans", "POST", role);

  const [actionId, setActionId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [createState, setCreateState] = useState<{
    presetDate: string | null;
    presetScheduleId: number | null;
  } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<{
    planId: number;
    rows: PlanCuttingRow[];
  } | null>(null);

  // URL 参数驱动新建/编辑弹窗：?create=1&date= / ?scheduleId=N / ?editId=N
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scheduleId = Number(params.get("scheduleId"));
    const editParam = Number(params.get("editId"));
    // 以 transition 更新，避免该 effect 同步触发级联渲染
    startTransition(() => {
      if (Number.isInteger(scheduleId) && scheduleId > 0) {
        setCreateState({ presetDate: null, presetScheduleId: scheduleId });
        router.replace("/production-plans");
      } else if (Number.isInteger(editParam) && editParam > 0) {
        setEditId(editParam);
        router.replace("/production-plans");
      } else if (params.get("create") === "1") {
        setCreateState({ presetDate: params.get("date"), presetScheduleId: null });
        router.replace("/production-plans");
      }
    });
  }, [router]);

  const closeCreateDialog = () => {
    setCreateState(null);
    setEditId(null);
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
      toast.success("切配计划已确认，进入进行中");
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
        toast.error("切配计划单不存在");
        return;
      }
      setCompleteTarget({ planId, rows: toPlanCuttingRows(data.cuttingOrders) });
    } catch {
      toast.error("获取切配计划单失败");
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="切配计划单"
          description="把各门店「进行中」的排程单汇总成一张切配执行单；切配完成后逐行确认并入库"
          actions={
            canWrite ? (
              <SkeuButton
                onClick={() =>
                  setCreateState({ presetDate: null, presetScheduleId: null })
                }
              >
                <Plus className="h-4 w-4" />
                新建切配计划
              </SkeuButton>
            ) : undefined
          }
        />
      }
    >
      <ListToolbar
        searchValue={board.search}
        onSearchChange={board.setSearch}
        searchPlaceholder="搜索切配计划单标题..."
        onReset={board.reset}
        hasFilters={!!board.date}
        trailing={
          <StatusColumnMenu visible={visibleStatuses} onChange={setStatuses} />
        }
      >
        <DatePicker
          value={board.date}
          onChange={board.setDate}
          placeholder="生产日期"
          className="w-[380px]"
          showWeekday
        />
      </ListToolbar>

      <div className="min-h-0 flex-1 overflow-auto">
        {board.loading && board.columns.length === 0 ? (
          <LoadingState type="card-grid" rows={3} />
        ) : (
          <KanbanBoard
            statuses={visibleStatuses}
            columns={board.columns}
            loading={board.loading}
            emptyText="暂无切配计划单"
            renderItem={(row) => (
              <ProductionPlanCard
                key={row.id}
                item={row}
                busy={actionId === row.id}
                canWrite={canWrite}
                onOpen={() => router.push(`/production-plans/${row.id}`)}
                onEdit={() => setEditId(row.id)}
                onActivate={() => activatePlan(row.id)}
                onComplete={() => openCompleteDialog(row.id)}
              />
            )}
          />
        )}
      </div>

      {(createState || editId) && (
        <ProductionPlanCreateDialog
          editId={editId}
          presetDate={createState?.presetDate ?? null}
          presetScheduleId={createState?.presetScheduleId ?? null}
          onClose={closeCreateDialog}
          onSaved={() => {
            closeCreateDialog();
            board.refresh();
          }}
        />
      )}

      <CompleteProductionDialog
        open={!!completeTarget}
        onOpenChange={(open) => {
          if (!open) setCompleteTarget(null);
        }}
        planId={completeTarget?.planId ?? 0}
        rows={completeTarget?.rows ?? []}
        onCompleted={() => board.refresh()}
      />
    </PageShell>
  );
}
