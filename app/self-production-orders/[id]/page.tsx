"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  ChefHat,
  Clock,
  FileStack,
  Loader2,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { InfoTile } from "@/app/components/ui/info-tile";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { SelfProductionItemsTable } from "@/app/components/self-production-order/self-production-items-table";
import { SelfProductionOrderDialog } from "@/app/components/self-production-order/self-production-order-dialog";
import type { SelfProductionOrderDetail } from "@/app/components/self-production-order/types";
import { parseObject } from "@/lib/client/api";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { toast } from "sonner";

type DetailTab = "items" | "plan";

export default function SelfProductionOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/self-production-orders", "POST", role);

  const [data, setData] = useState<SelfProductionOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("items");
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/self-production-orders/" + id);
        const detail = await parseObject<SelfProductionOrderDetail>(res);
        if (!detail) {
          if (alive) toast.error("内部生产单不存在");
          return;
        }
        if (alive) setData(detail);
      } catch {
        if (alive) toast.error("获取数据失败");
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
      const res = await fetch(`/api/self-production-orders/${id}/activate`, { method: "PUT" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "确认失败");
        return;
      }
      toast.success("已确认生产，进入进行中");
      setActivateOpen(false);
      refresh();
    } catch {
      toast.error("确认出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/self-production-orders/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "删除失败");
        return;
      }
      toast.success("内部生产单已删除");
      setDeleteOpen(false);
      router.push("/self-production-orders");
    } catch {
      toast.error("删除出错");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !data) {
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
          title="内部生产单不存在"
          description="该单据可能已删除，或当前链接已失效。"
          action={{
            label: "返回内部生产单列表",
            onClick: () => router.push("/self-production-orders"),
          }}
        />
      </PageShell>
    );
  }

  const plan = data.productionPlan;
  const totalPortions = Math.round(data.items.reduce((sum, item) => sum + item.portions, 0) * 100) / 100;
  const totalRequiredQty =
    Math.round(data.items.reduce((sum, item) => sum + (item.requiredQty ?? 0), 0) * 100) / 100;
  const totalGrossJin =
    Math.round(data.items.reduce((sum, item) => sum + (item.grossNeedJin ?? 0), 0) * 100) / 100;

  return (
    <PageShell>
      <PageHeader
        showBack
        backHref="/self-production-orders"
        backLabel="返回内部生产单列表"
        title={data.title}
        meta={<ScheduleStatusTag status={data.status} />}
        description={
          <>
            {data.code ?? `内部生产单 #${data.id}`} · 制单人{" "}
            {data.operatorName || data.operator || "—"}
          </>
        }
        actions={
          <>
            {plan && (
              <Button
                variant="outline"
                onClick={() => router.push(`/production-plans/${plan.id}`)}
              >
                <FileStack className="mr-2 h-4 w-4" />
                查看生产计划
              </Button>
            )}
            {canWrite && data.status === "待生效" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(true)}
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
                  确认生产
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={CalendarDays}
          label="生产日期"
          value={formatDate(data.produceDate)}
          helper={getWeekDay(data.produceDate)}
        />
        <InfoTile
          icon={ChefHat}
          label="明细与份数"
          value={`${data.items.length} 种 / ${totalPortions} 份`}
          helper={`切配量 ${totalRequiredQty}g / 毛料 ${totalGrossJin} 斤`}
        />
        <InfoTile
          icon={Clock}
          label="制单信息"
          value={data.operatorName || data.operator || "—"}
          helper={new Date(data.createdAt).toLocaleString("zh-CN")}
        />
        <InfoTile
          icon={FileStack}
          label="生产计划"
          value={plan ? plan.code ?? `#${plan.id}` : "未纳入"}
          helper={plan ? plan.title : "确认生产后可在生产计划中勾选"}
        />
      </div>

      {plan ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          <FileStack className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            已纳入生产计划单{" "}
            <span className="font-mono text-xs">{plan.code ?? `PPL-${plan.id}`}</span>
            {" · "}
            {plan.title}
          </span>
          <Button size="sm" variant="outline" onClick={() => router.push(`/production-plans/${plan.id}`)}>
            查看生产计划
          </Button>
        </div>
      ) : (
        data.status !== "待生效" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <FileStack className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">
              尚未纳入生产计划单，可到生产计划单中与门店排程一起勾选。
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/production-plans")}
            >
              前往生产计划单
            </Button>
          </div>
        )
      )}

      {data.remark && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          备注：{data.remark}
        </div>
      )}

      <div className="min-w-0">
        <SectionTabs
          ariaLabel="内部生产单内容"
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: "items", label: "生产明细", count: data.items.length },
            { value: "plan", label: "生产计划", count: plan ? 1 : 0 },
          ]}
        />
        <div className="min-w-0 pt-4">
          {activeTab === "items" &&
            (data.items.length > 0 ? (
              <SelfProductionItemsTable items={data.items} />
            ) : (
              <EmptyState
                icon={ChefHat}
                title="暂无生产明细"
                description="这张内部生产单还没有净料/小料明细。"
              />
            ))}
          {activeTab === "plan" &&
            (plan ? (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FileStack className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {plan.code ?? `PPL-${plan.id}`}
                  </span>
                  <span className="font-medium">{plan.title}</span>
                  <ScheduleStatusTag status={plan.status} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground">
                  生产日期 {formatDate(plan.planDate)} · 已纳入生产计划单
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/production-plans/${plan.id}`)}
                >
                  查看生产计划
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={FileStack}
                title="尚未纳入生产计划"
                description="确认生产后，可在生产计划单中与门店排程一起勾选。"
              />
            ))}
        </div>
      </div>

      {editOpen && (
        <SelfProductionOrderDialog
          mode="edit"
          orderId={id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}

      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认生产</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确认后进入「进行中」，可被生产计划单勾选；确认后不可修改或删除。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivateOpen(false)}
              disabled={actionLoading}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button onClick={handleActivate} disabled={actionLoading} className="h-11 px-6">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认生产
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除内部生产单「{data.title}」吗？删除后不可恢复。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={actionLoading}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
              className="h-11 px-6"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
