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
import { SkeuListSelect } from "@/app/components/ui/skeu-list-select";
import { SkeuDotSelect } from "@/app/components/ui/skeu-dot-select";
import { SchedulePreviewDialog } from "@/app/components/ui/schedule-preview-dialog";
import { ScheduleCard } from "@/app/components/schedule/schedule-card";
import { KanbanBoard } from "@/app/components/schedule/kanban-board";
import { StatusColumnMenu } from "@/app/components/schedule/status-column-menu";
import { ScheduleCreateDialog } from "@/app/components/schedule/schedule-create-dialog";
import { useScheduleBoard } from "@/app/components/schedule/use-schedule-board";
import { useStatusVisibility } from "@/app/components/schedule/use-status-visibility";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { toast } from "sonner";

export default function SchedulesPage() {
  const router = useRouter();
  const { visible: visibleStatuses, setStatuses } = useStatusVisibility(
    "lean-kms:schedules:visible-statuses"
  );
  const board = useScheduleBoard(visibleStatuses);
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/schedules", "POST", role);

  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [actionId, setActionId] = useState<number | null>(null);

  const [previewId, setPreviewId] = useState<number | null>(null);
  const [createState, setCreateState] = useState<{
    copyFromId: number | null;
    editId: number | null;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const copy = Number(params.get("copyFrom"));
    // 以 transition 更新，避免该 effect 同步触发级联渲染
    startTransition(() => {
      if (Number.isInteger(copy) && copy > 0) {
        setCreateState({ copyFromId: copy, editId: null });
      } else if (params.get("create") === "1") {
        setCreateState({ copyFromId: null, editId: null });
      }
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores?pageSize=100");
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
        if (alive) setStores(list);
      } catch {
        if (alive) toast.error("获取门店失败");
      }
    };
    fetchStores();
    return () => {
      alive = false;
    };
  }, []);

  const closeQuickView = () => {
    setPreviewId(null);
  };

  const activateSchedule = async (id: number) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/schedules/${id}/activate`, { method: "PUT" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success("已确认生产，排程进入进行中");
      board.refresh();
    } catch {
      toast.error("操作出错");
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
          title="排菜"
          description="门店按售卖日期排菜品与份数；确认后进入进行中，由切配中心汇总成切配计划单"
          actions={
            canWrite ? (
              <SkeuButton onClick={() => setCreateState({ copyFromId: null, editId: null })}>
                <Plus className="h-4 w-4" />
                去排菜
              </SkeuButton>
            ) : undefined
          }
        />
      }
    >
      <ListToolbar
        searchValue={board.search}
        onSearchChange={board.setSearch}
        searchPlaceholder="搜索排程标题..."
        onReset={board.reset}
        hasFilters={!!(board.date || board.storeId)}
        trailing={
          <StatusColumnMenu visible={visibleStatuses} onChange={setStatuses} />
        }
      >
        <DatePicker
          value={board.date}
          onChange={board.setDate}
          placeholder="售卖日期"
          className="w-[200px]"
          showWeekday
        />
        {stores.length <= 5 ? (
          <SkeuDotSelect
            value={board.storeId}
            onChange={board.setStoreId}
            options={[
              { value: "", label: "全部门店", tone: "all" },
              ...stores.map((store) => ({
                value: String(store.id),
                label: store.name,
                tone: "all" as const,
              })),
            ]}
            aria-label="选择门店"
          />
        ) : (
          <SkeuListSelect
            options={[
              ...stores.map((store) => ({
                value: String(store.id),
                label: store.name,
              })),
            ]}
            value={board.storeId}
            onChange={board.setStoreId}
            allLabel="全部门店"
            ariaLabel="选择门店"
            className="w-[160px]"
          />
        )}
      </ListToolbar>

      <div className="min-h-0 flex-1 overflow-auto">
        {board.loading && board.columns.length === 0 ? (
          <LoadingState type="card-grid" rows={3} />
        ) : (
          <KanbanBoard
            statuses={visibleStatuses}
            columns={board.columns}
            loading={board.loading}
            emptyText="暂无排程单"
            renderItem={(row) => (
              <ScheduleCard
                key={row.id}
                item={row}
                busy={actionId === row.id}
                canWrite={canWrite}
                onOpen={() => setPreviewId(row.id)}
                onEdit={() => setCreateState({ copyFromId: null, editId: row.id })}
                onActivate={() => activateSchedule(row.id)}
                onGotoPlan={(planId) => router.push(`/production-plans/${planId}`)}
              />
            )}
          />
        )}
      </div>

      <SchedulePreviewDialog
        scheduleId={previewId}
        onClose={closeQuickView}
      />

      {createState && (
        <ScheduleCreateDialog
          copyFromId={createState.copyFromId}
          editId={createState.editId}
          onClose={() => setCreateState(null)}
          onEdited={() => {
            setCreateState(null);
            board.refresh();
          }}
          onCreated={(id) => {
            setCreateState(null);
            board.refresh();
            if (id) router.push(`/schedules/${id}`);
          }}
        />
      )}
    </PageShell>
  );
}
