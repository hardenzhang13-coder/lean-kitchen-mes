"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Ban,
  CalendarDays,
  ChefHat,
  Clock,
  Copy,
  FileStack,
  MapPin,
  Pencil,
  Play,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { ScheduleCreateDialog } from "@/app/components/schedule/schedule-create-dialog";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import {
  ScheduleCuttingTable,
  type CuttingOrderRow,
  type ScheduleDocMeta,
} from "@/app/components/schedule/schedule-cutting-table";
import {
  SchedulePurchaseTable,
  type PurchasePlanRow,
} from "@/app/components/schedule/schedule-purchase-table";
import { ScheduleMenuTable } from "@/app/components/schedule/schedule-menu-table";
import { SalesRecordPanel } from "@/app/components/schedule/sales-record-panel";
import {
  SalesRecordDialog,
  type SalesRecordItem,
} from "@/app/components/schedule/sales-record-dialog";

type DetailTab = "menu" | "cutting" | "purchase" | "sales";

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

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/schedules", "POST", role);

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("menu");
  const [recordOpen, setRecordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
        const res = await fetch(`/api/schedules/${id}`);
        const result = await parseObject<ScheduleData>(res);
        if (!result) {
          if (alive) toast.error("排程不存在");
          return;
        }
        if (!alive) return;
        setData(result);
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
        const result = await res.json();
        toast.error(result.error || "操作失败");
        return;
      }
      toast.success("已确认生产，排程进入进行中");
      setActivateOpen(false);
      refresh();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}/void`, { method: "PUT" });
      if (!res.ok) {
        const result = await res.json();
        toast.error(result.error || "操作失败");
        return;
      }
      toast.success("排程单已作废，回退到待生效");
      setVoidOpen(false);
      router.push("/schedules");
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
        const result = await res.json();
        toast.error(result.error || "删除失败");
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
          title="排程不存在"
          description="该排程可能已被删除，或当前链接已失效。"
          action={{ label: "返回排菜列表", onClick: () => router.push("/schedules") }}
        />
      </PageShell>
    );
  }

  const docMeta: ScheduleDocMeta = {
    title: data.title,
    scheduleDate: data.scheduleDate,
    storeName: data.store?.name ?? "",
    scheduleId: data.id,
    code: data.code,
  };

  const plan = data.productionPlan;
  const pendingSoldCount = data.items.filter((item) => item.soldQty == null).length;
  const showSalesTab = data.status !== "待生效";
  // 缺封装规格的切配行到「完成生产」时会整单回滚，提前在详情里点出来
  const missingPackageSpec = data.cuttingOrders.filter(
    (row) => !row.packageSpec || row.packageSpec <= 0
  );

  return (
    <PageShell>
      <PageHeader
        showBack
        backHref="/schedules"
        backLabel="返回排菜列表"
        title={data.title}
        meta={<ScheduleStatusTag status={data.status} />}
        description={
          <>
            {data.code ?? `排程 #${data.id}`} · 制单人 {data.operatorName || data.operator || "—"}
          </>
        }
        actions={
          <>
            <SkeuButton
              variant="outline"
              onClick={() =>
                window.open(
                  `/schedules/${id}/print?doc=cutting`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <Printer className="h-4 w-4" />
              打印切配工单
            </SkeuButton>
            {canWrite && (
              <SkeuButton
                variant="outline"
                onClick={() => router.push(`/schedules?copyFrom=${id}`)}
                disabled={actionLoading}
              >
                <Copy className="h-4 w-4" />
                复制
              </SkeuButton>
            )}
            {canWrite && data.status === "待生效" && (
              <>
                <SkeuButton variant="outline" onClick={() => setEditOpen(true)} disabled={actionLoading}>
                  <Pencil className="h-4 w-4" />
                  修改
                </SkeuButton>
                <SkeuButton
                  variant="ghost"
                  className="text-[#b42318] hover:bg-[#fdecea] hover:text-[#b42318]"
                  onClick={() => setDeleteOpen(true)}
                  disabled={actionLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </SkeuButton>
                <SkeuButton onClick={() => setActivateOpen(true)} disabled={actionLoading}>
                  <Play className="h-4 w-4" />
                  确认生产
                </SkeuButton>
              </>
            )}
            {canWrite && data.status === "已完成" && (
              <SkeuButton
                variant="ghost"
                className="text-[#b42318] hover:bg-[#fdecea] hover:text-[#b42318]"
                onClick={() => setDeleteOpen(true)}
                disabled={actionLoading}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </SkeuButton>
            )}
            {canWrite && data.status === "进行中" && !plan && (
              <SkeuButton onClick={() => router.push(`/production-plans?scheduleId=${id}`)}>
                <Plus className="h-4 w-4" />
                纳入切配计划单
              </SkeuButton>
            )}
            {data.status === "进行中" && plan && (
              <SkeuButton variant="outline" onClick={() => router.push(`/production-plans/${plan.id}`)}>
                <FileStack className="h-4 w-4" />
                查看切配计划
              </SkeuButton>
            )}
            {canWrite && data.status === "进行中" && (
              <SkeuButton
                variant="ghost"
                className="text-[#b42318] hover:bg-[#fdecea] hover:text-[#b42318]"
                onClick={() => setVoidOpen(true)}
                disabled={actionLoading}
              >
                <Ban className="h-4 w-4" />
                作废
              </SkeuButton>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={CalendarDays}
          label="售卖日期"
          value={formatDate(data.scheduleDate)}
          helper={getWeekDay(data.scheduleDate)}
        />
        <InfoTile
          icon={MapPin}
          label="门店"
          value={data.store?.name ?? "—"}
        />
        <InfoTile
          icon={ChefHat}
          label="菜品与份数"
          value={`${data.dishCount} 个菜品 / ${data.totalQuantity} 份`}
          helper={`切配 ${data.cuttingOrders.length} 项 / 采购 ${data.purchasePlans.length} 项`}
        />
        <InfoTile
          icon={Clock}
          label="制单信息"
          value={data.operatorName || data.operator || "—"}
          helper={new Date(data.createdAt).toLocaleString("zh-CN")}
        />
      </div>

      {plan ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-4 py-3 text-sm shadow-sk-raised">
          <FileStack className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">
            已纳入切配计划单{" "}
            <span className="font-mono text-xs">{plan.code ?? `PPL-${plan.id}`}</span>
            {" · "}
            {plan.title}
          </span>
          <SkeuButton size="sm" variant="outline" onClick={() => router.push(`/production-plans/${plan.id}`)}>
            查看切配计划
          </SkeuButton>
        </div>
      ) : (
        data.status === "进行中" && (
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-4 py-3 text-sm shadow-sk-raised">
            <FileStack className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-muted-foreground">
              尚未纳入切配计划单，切配中心汇总后才会开始切配与入库。
            </span>
            <SkeuButton size="sm" variant="outline" onClick={() => router.push(`/production-plans?scheduleId=${id}`)}>
              纳入切配计划单
            </SkeuButton>
          </div>
        )
      )}

      {showSalesTab && pendingSoldCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--sk-radius-md)] border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] px-4 py-3 text-sm shadow-sk-raised">
          <span className="flex-1 text-[var(--status-warning)]">
            <b className="text-foreground">
              还有 {pendingSoldCount} 个菜品未回录售出份数
            </b>
            {" "}· 回录后用于复盘与下一次排程
          </span>
          <SkeuButton size="sm" onClick={() => setRecordOpen(true)}>
            去回录
          </SkeuButton>
        </div>
      )}

      <div className="min-w-0">
        <PageTabs
          ariaLabel="排程内容"
          value={activeTab}
          onChange={(value) => setActiveTab(value as DetailTab)}
          tabs={[
            { value: "menu", label: "排程菜单", count: data.items.length },
            { value: "cutting", label: "切配工单", count: data.cuttingOrders.length },
            { value: "purchase", label: "采购计划", count: data.purchasePlans.length },
            ...(showSalesTab
              ? [
                  {
                    value: "sales" as const,
                    label: "销售回录",
                    count: pendingSoldCount > 0 ? undefined : data.items.length,
                  },
                ]
              : []),
          ]}
        />
        <div className="min-w-0 pt-4">
          {activeTab === "menu" &&
            (data.items.length > 0 ? (
              <ScheduleMenuTable items={data.items} meta={docMeta} />
            ) : (
              <EmptyState
                icon={ChefHat}
                title="暂无菜单数据"
                description="这张排程还没有菜品明细。"
              />
            ))}
          {activeTab === "cutting" &&
            (data.cuttingOrders.length > 0 ? (
              <div className="min-w-0 space-y-3">
                {missingPackageSpec.length > 0 && (
                  <div className="rounded-[var(--sk-radius-md)] border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] px-4 py-3 text-sm shadow-sk-raised">
                    <b className="text-foreground">
                      {missingPackageSpec.length} 个净料缺少封装规格
                    </b>
                    <span className="text-[var(--status-warning)]">
                      {" "}· 这些行在完成生产时无法按份入库，请先到食材库补齐封装规格（
                      {missingPackageSpec.map((row) => row.itemName).join("、")}
                      ）
                    </span>
                  </div>
                )}
                <ScheduleCuttingTable rows={data.cuttingOrders} meta={docMeta} />
              </div>
            ) : (
              <EmptyState
                icon={ChefHat}
                title="暂无切配工单"
                description="菜单中没有净料需求。"
              />
            ))}
          {activeTab === "purchase" &&
            (data.purchasePlans.length > 0 ? (
              <SchedulePurchaseTable rows={data.purchasePlans} meta={docMeta} />
            ) : (
              <EmptyState
                icon={ChefHat}
                title="暂无采购计划"
                description="菜单中没有原料、调味品或酱料需求。"
              />
            ))}
          {activeTab === "sales" && (
            <SalesRecordPanel
              items={data.items}
              onOpenRecord={() => setRecordOpen(true)}
            />
          )}
        </div>
      </div>

      <SalesRecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        scheduleId={data.id}
        scheduleCode={data.code}
        items={data.items as SalesRecordItem[]}
        onSaved={refresh}
      />

      {editOpen && (
        <ScheduleCreateDialog
          editId={id}
          onClose={() => setEditOpen(false)}
          onEdited={() => {
            setEditOpen(false);
            refresh();
          }}
          onCreated={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            {data.status === "已完成"
              ? "确定要删除这条已完成的排程吗？排程及切配工单、采购计划、销售回录将一并删除；出库单与库存流水保留历史快照不受影响。此操作不可撤销。"
              : "确定要删除这条排程吗？切配工单与采购计划将一并删除，此操作不可撤销。"}
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
            <DialogTitle className="text-lg">确认生产</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            确认后排程进入「进行中」，菜品、份数、门店和售卖日期不可再修改，也不能删除；
            下一步把它纳入切配计划单，切配中心才会开始执行。
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setActivateOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton onClick={handleActivate} disabled={actionLoading}>
              确认并进入生产
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">作废排程单</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            作废后排程单回退到「待生效」，可以重新编辑修改；已有切配完成记录，
            或已纳入未删除的切配计划单时不能作废。
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
