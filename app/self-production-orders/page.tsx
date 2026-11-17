"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/app/components/ui/date-picker";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { ProductionModuleSwitcher } from "@/app/components/ui/production-module-switcher";
import { SelfProductionOrderPreviewDialog } from "@/app/components/ui/self-production-order-preview-dialog";
import { KanbanBoard } from "@/app/components/schedule/kanban-board";
import { StatusColumnMenu } from "@/app/components/schedule/status-column-menu";
import { useSelfProductionBoard } from "@/app/components/schedule/use-schedule-board";
import { useStatusVisibility } from "@/app/components/schedule/use-status-visibility";
import { SelfProductionOrderCard } from "@/app/components/self-production-order/self-production-order-card";
import { SelfProductionOrderDialog } from "@/app/components/self-production-order/self-production-order-dialog";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { toast } from "sonner";

/** 内部生产单：切配中心按日期内部生产净料/小料，确认后可纳入生产计划。 */
export default function SelfProductionOrdersPage() {
  const router = useRouter();
  const { visible: visibleStatuses, setStatuses } = useStatusVisibility(
    "lean-kms:self-production-orders:visible-statuses"
  );
  const board = useSelfProductionBoard(visibleStatuses);
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/self-production-orders", "POST", role);

  const [actionId, setActionId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const activateOrder = async (id: number) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/self-production-orders/${id}/activate`, {
        method: "PUT",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success("已确认生产，进入进行中");
      board.refresh();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="内部生产单"
        description="切配中心按日期内部生产净料/小料；确认后可与门店排程一起汇总到生产计划单"
        actions={
          <>
            <ProductionModuleSwitcher />
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                内部生产
              </Button>
            )}
          </>
        }
      />

      <ListToolbar
        searchValue={board.search}
        onSearchChange={board.setSearch}
        searchPlaceholder="搜索内部生产单标题..."
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
          className="w-[190px]"
          showWeekday
        />
      </ListToolbar>

      {board.loading && board.columns.length === 0 ? (
        <LoadingState type="card-grid" rows={3} />
      ) : (
        <KanbanBoard
          statuses={visibleStatuses}
          columns={board.columns}
          loading={board.loading}
          emptyText="暂无内部生产单"
          renderItem={(row) => (
            <SelfProductionOrderCard
              key={row.id}
              item={row}
              busy={actionId === row.id}
              canWrite={canWrite}
              onOpen={() => setPreviewId(row.id)}
              onActivate={() => activateOrder(row.id)}
              onGotoPlan={(planId) => router.push(`/production-plans/${planId}`)}
            />
          )}
        />
      )}

      <SelfProductionOrderPreviewDialog
        orderId={previewId}
        onClose={() => setPreviewId(null)}
      />

      {createOpen && (
        <SelfProductionOrderDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            board.refresh();
          }}
        />
      )}
    </PageShell>
  );
}
