"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, FileStack } from "lucide-react";
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
import { SelfProductionItemsTable } from "@/app/components/self-production-order/self-production-items-table";
import type { SelfProductionOrderDetail } from "@/app/components/self-production-order/types";
import { formatDate, getWeekDay } from "@/lib/shared/date-format";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface SelfProductionOrderPreviewDialogProps {
  /** 传入单据 id 打开预览；null 表示关闭 */
  orderId: number | null;
  onClose: () => void;
}

type PreviewTab = "items" | "plan";

/** 内部生产单预览弹窗：与排程/生产计划预览同构（明细页签 + 关联计划 + 查看完整详情）。 */
export function SelfProductionOrderPreviewDialog({
  orderId,
  onClose,
}: SelfProductionOrderPreviewDialogProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<SelfProductionOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<PreviewTab>("items");

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：setState 均发生在 await 之后的异步回调中。 */
  useEffect(() => {
    if (orderId == null) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setDetail(null);
    setTab("items");
    const load = async () => {
      try {
        const res = await fetch(`/api/self-production-orders/${orderId}`);
        const data = await parseObject<SelfProductionOrderDetail>(res);
        if (!alive) return;
        if (!data) {
          setFailed(true);
          return;
        }
        setDetail(data);
      } catch {
        if (!alive) return;
        setFailed(true);
        toast.error("获取内部生产单失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [orderId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const plan = detail?.productionPlan ?? null;
  const totalPortions = detail
    ? Math.round(detail.items.reduce((sum, item) => sum + item.portions, 0) * 100) / 100
    : 0;

  return (
    <Dialog open={orderId != null} onOpenChange={(open) => !open && onClose()}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">
            {detail?.title ?? "内部生产单预览"}
          </DialogTitle>
          {detail && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <ScheduleStatusTag status={detail.status} size="sm" />
              <span>
                {formatDate(detail.produceDate)} {getWeekDay(detail.produceDate)}
              </span>
              <span>
                {detail.items.length} 种净料 / {totalPortions} 份
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState type="page" />
          ) : failed || !detail ? (
            <EmptyState
              icon={FileQuestion}
              title="内部生产单不存在"
              description="该单据可能已被删除，请返回列表刷新后再试。"
            />
          ) : (
            <>
              <SectionTabs
                ariaLabel="内部生产单预览内容"
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "items", label: "生产明细", count: detail.items.length },
                  { value: "plan", label: "生产计划", count: plan ? 1 : 0 },
                ]}
              />
              <div className="pt-4">
                {tab === "items" &&
                  (detail.items.length > 0 ? (
                    <SelfProductionItemsTable items={detail.items} />
                  ) : (
                    <EmptyState
                      title="暂无生产明细"
                      description="这张内部生产单还没有净料/小料明细。"
                    />
                  ))}
                {tab === "plan" &&
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
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 pb-5 pt-4">
          <Button
            onClick={() => detail && router.push(`/self-production-orders/${detail.id}`)}
            disabled={!detail}
          >
            查看完整详情
          </Button>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
