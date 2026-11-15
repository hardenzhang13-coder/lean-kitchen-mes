"use client";

import { useEffect, useState, startTransition } from "react";
import { Plus } from "lucide-react";
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
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { ScheduleMenuTable } from "@/app/components/schedule/schedule-menu-table";
import { ScheduleCuttingTable } from "@/app/components/schedule/schedule-cutting-table";
import { SchedulePurchaseTable } from "@/app/components/schedule/schedule-purchase-table";
import { ScheduleCard } from "@/app/components/schedule/schedule-card";
import { KanbanBoard } from "@/app/components/schedule/kanban-board";
import { ScheduleCreateDialog } from "@/app/components/schedule/schedule-create-dialog";
import { useScheduleBoard } from "@/app/components/schedule/use-schedule-board";
import type {
  QuickTab,
  ScheduleDocMeta,
  ScheduleQuickDetail,
} from "@/app/components/schedule/list-types";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

export default function SchedulesPage() {
  const router = useRouter();
  const board = useScheduleBoard();
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/schedules", "POST", role);

  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [actionId, setActionId] = useState<number | null>(null);

  const [quickView, setQuickView] = useState<ScheduleQuickDetail | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickTab, setQuickTab] = useState<QuickTab>("menu");
  const [createState, setCreateState] = useState<{ copyFromId: number | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const copy = Number(params.get("copyFrom"));
    // 以 transition 更新，避免该 effect 同步触发级联渲染
    startTransition(() => {
      if (Number.isInteger(copy) && copy > 0) {
        setCreateState({ copyFromId: copy });
      } else if (params.get("create") === "1") {
        setCreateState({ copyFromId: null });
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

  const openQuickView = async (id: number) => {
    setQuickViewLoading(true);
    setQuickTab("menu");
    try {
      const res = await fetch("/api/schedules/" + id);
      const data = await parseObject<ScheduleQuickDetail>(res);
      if (!data) {
        toast.error("排程不存在");
        return;
      }
      setQuickView(data);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setQuickViewLoading(false);
    }
  };

  const closeQuickView = () => {
    setQuickView(null);
    setQuickViewLoading(false);
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

  const quickMeta: ScheduleDocMeta | null = quickView
    ? {
        title: quickView.title,
        scheduleDate: quickView.scheduleDate,
        storeName: quickView.store?.name ?? "",
        scheduleId: quickView.id,
        code: quickView.code,
      }
    : null;

  return (
    <PageShell>
      <PageHeader
        title="菜品排程单"
        description="门店按日期报菜品与份数；确认后进入进行中，由切配中心汇总成生产计划单"
        actions={
          canWrite ? (
            <Button onClick={() => setCreateState({ copyFromId: null })}>
              <Plus className="mr-2 h-4 w-4" />
              菜品排程
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        searchValue={board.search}
        onSearchChange={board.setSearch}
        searchPlaceholder="搜索排程标题..."
        onReset={board.reset}
        hasFilters={!!(board.date || board.storeId)}
      >
        <DatePicker
          value={board.date}
          onChange={board.setDate}
          placeholder="售卖日期"
          className="w-[190px]"
          showWeekday
        />
        <SelectTileMode
          options={[
            { value: "all", label: "全部门店" },
            ...stores.map((store) => ({ value: String(store.id), label: store.name })),
          ]}
          value={board.storeId}
          onChange={board.setStoreId}
          placeholder="全部门店"
          title="选择门店"
          className="w-[180px]"
        />
      </ListToolbar>

      {board.loading && board.columns.length === 0 ? (
        <LoadingState type="card-grid" rows={3} />
      ) : (
        <KanbanBoard
          columns={board.columns}
          loading={board.loading}
          emptyText="暂无排程单"
          renderItem={(row) => (
            <ScheduleCard
              key={row.id}
              item={row}
              busy={actionId === row.id}
              canWrite={canWrite}
              onOpen={() => openQuickView(row.id)}
              onActivate={() => activateSchedule(row.id)}
              onGotoPlan={(planId) => router.push(`/production-plans/${planId}`)}
            />
          )}
        />
      )}

      <Dialog
        open={quickViewLoading || !!quickView}
        onOpenChange={(open) => !open && closeQuickView()}
      >
        <AppDialogContent
          size="workbench"
          className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
        >
          <DialogHeader className="border-b px-6 pb-4 pt-6">
            <DialogTitle className="text-lg">
              {quickView?.title ?? "排程预览"}
            </DialogTitle>
            {quickView && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <ScheduleStatusTag status={quickView.status} size="sm" />
                <span>
                  {formatDate(quickView.scheduleDate)}{" "}
                  {getWeekDay(quickView.scheduleDate)}
                </span>
                <span>{quickView.store?.name ?? "—"}</span>
                <span>
                  {quickView.dishCount} 个菜品 / {quickView.totalQuantity} 份
                </span>
              </div>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {quickViewLoading || !quickView || !quickMeta ? (
              <LoadingState type="page" />
            ) : (
              <>
                <SectionTabs
                  ariaLabel="排程预览内容"
                  value={quickTab}
                  onChange={setQuickTab}
                  tabs={[
                    { value: "menu", label: "排程菜单", count: quickView.items.length },
                    { value: "cutting", label: "切配工单", count: quickView.cuttingOrders.length },
                    { value: "purchase", label: "采购计划", count: quickView.purchasePlans.length },
                  ]}
                />
                <div className="pt-4">
                  {quickTab === "menu" && (
                    <ScheduleMenuTable items={quickView.items} meta={quickMeta} />
                  )}
                  {quickTab === "cutting" && (
                    <ScheduleCuttingTable rows={quickView.cuttingOrders} meta={quickMeta} />
                  )}
                  {quickTab === "purchase" && (
                    <SchedulePurchaseTable rows={quickView.purchasePlans} meta={quickMeta} />
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t px-6 pb-5 pt-4">
            <Button
              onClick={() => quickView && router.push(`/schedules/${quickView.id}`)}
              disabled={!quickView}
            >
              查看完整详情
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      {createState && (
        <ScheduleCreateDialog
          copyFromId={createState.copyFromId}
          onClose={() => setCreateState(null)}
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
