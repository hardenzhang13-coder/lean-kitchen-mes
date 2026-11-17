"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { ProductionPlanStoreSchedules } from "@/app/components/production-plan/store-schedules-tab";
import { ProductionPlanSelfProduction } from "@/app/components/production-plan/self-production-tab";
import { ScheduleCuttingTable } from "@/app/components/schedule/schedule-cutting-table";
import { SchedulePurchaseTable } from "@/app/components/schedule/schedule-purchase-table";
import type {
  PlanPreviewTab,
  ProductionPlanPreview,
  ScheduleDocMeta,
} from "@/app/components/schedule/list-types";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface ProductionPlanPreviewDialogProps {
  /** 传入单据 id 打开预览；null 表示关闭 */
  planId: number | null;
  onClose: () => void;
}

/**
 * 生产计划单预览弹窗：切配汇总 / 采购汇总 / 门店排程三个页签。
 * 生产计划列表页与工作台共用同一份预览行为。
 */
export function ProductionPlanPreviewDialog({
  planId,
  onClose,
}: ProductionPlanPreviewDialogProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<ProductionPlanPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<PlanPreviewTab>("cutting");

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => {
    if (planId == null) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setPreview(null);
    setTab("cutting");
    const load = async () => {
      try {
        const res = await fetch(`/api/production-plans/${planId}`);
        const data = await parseObject<ProductionPlanPreview>(res);
        if (!alive) return;
        if (!data) {
          setFailed(true);
          return;
        }
        setPreview(data);
      } catch {
        if (!alive) return;
        setFailed(true);
        toast.error("获取生产计划单失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [planId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const meta: ScheduleDocMeta | null = preview
    ? {
        title: preview.title,
        scheduleDate: preview.planDate,
        storeName: "",
        scheduleId: preview.id,
        code: preview.code,
        printBase: "/production-plans/",
      }
    : null;

  const printLabels = (id: number) => {
    window.open(`/production-plans/${id}/labels`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={planId != null} onOpenChange={(open) => !open && onClose()}>
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
              <span>
                汇总 {preview.sourceSchedules.length} 张排程单
                {(preview.selfOrders?.length ?? 0) > 0
                  ? ` · ${preview.selfOrders?.length} 张内部生产单`
                  : ""}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState type="page" />
          ) : failed || !preview || !meta ? (
            <EmptyState
              icon={FileQuestion}
              title="生产计划单不存在"
              description="该单据可能已被删除，请返回列表刷新后再试。"
            />
          ) : (
            <>
              <SectionTabs
                ariaLabel="生产计划单预览内容"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "cutting", label: "切配汇总", count: preview.cuttingOrders.length },
                  { value: "purchase", label: "采购汇总", count: preview.purchasePlans.length },
                  { value: "stores", label: "门店排程", count: preview.sourceSchedules.length },
                  { value: "self", label: "内部生产", count: preview.selfOrders?.length ?? 0 },
                ]}
              />
              <div className="pt-4">
                {tab === "cutting" && (
                  <ScheduleCuttingTable
                    rows={preview.cuttingOrders}
                    meta={meta}
                    enableLabelPrint
                  />
                )}
                {tab === "purchase" && (
                  <SchedulePurchaseTable rows={preview.purchasePlans} meta={meta} />
                )}
                {tab === "stores" &&
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
                {tab === "self" &&
                  (preview.sourceSnapshot ? (
                    <ProductionPlanSelfProduction
                      snapshot={preview.sourceSnapshot}
                      selfOrders={(preview.selfOrders ?? []).map((order) => ({
                        id: order.id,
                        status: order.status,
                      }))}
                    />
                  ) : (
                    <EmptyState
                      icon={CalendarDays}
                      title="没有来源内部生产数据"
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
  );
}
