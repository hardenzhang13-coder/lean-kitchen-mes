"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, FileQuestion } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
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
import { PageTabs } from "@/app/components/ui/page-tabs";
import { ScheduleCuttingTable } from "@/app/components/schedule/schedule-cutting-table";
import { ScheduleMenuTable } from "@/app/components/schedule/schedule-menu-table";
import { SchedulePurchaseTable } from "@/app/components/schedule/schedule-purchase-table";
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

interface SchedulePreviewDialogProps {
  /** 传入单据 id 打开预览；null 表示关闭 */
  scheduleId: number | null;
  onClose: () => void;
}

/**
 * 排程单预览弹窗：菜单 / 切配工单 / 采购计划三个页签。
 * 排程列表页与工作台共用同一份预览行为。
 */
export function SchedulePreviewDialog({
  scheduleId,
  onClose,
}: SchedulePreviewDialogProps) {
  const router = useRouter();
  const role = useCurrentRole();
  const canWrite = canAccessApi("/api/schedules", "POST", role);
  const [detail, setDetail] = useState<ScheduleQuickDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<QuickTab>("menu");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const handleVoid = async () => {
    if (!detail) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/schedules/${detail.id}/void`, { method: "PUT" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "操作失败");
        return;
      }
      toast.success("排程单已作废，回退到待生效");
      setVoidOpen(false);
      setDetail({ ...detail, status: "待生效" });
    } catch {
      toast.error("操作出错");
    } finally {
      setVoiding(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式（无框架数据层时的标准写法）；setState 均发生在 await 之后的异步回调中，不构成同步级联渲染。 */
  useEffect(() => {
    if (scheduleId == null) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setDetail(null);
    setTab("menu");
    const load = async () => {
      try {
        const res = await fetch(`/api/schedules/${scheduleId}`);
        const data = await parseObject<ScheduleQuickDetail>(res);
        if (!alive) return;
        if (!data) {
          setFailed(true);
          return;
        }
        setDetail(data);
      } catch {
        if (!alive) return;
        setFailed(true);
        toast.error("获取排程数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [scheduleId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const meta: ScheduleDocMeta | null = detail
    ? {
        title: detail.title,
        scheduleDate: detail.scheduleDate,
        storeName: detail.store?.name ?? "",
        scheduleId: detail.id,
        code: detail.code,
      }
    : null;

  return (
    <Dialog
      open={scheduleId != null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex h-[min(780px,calc(100dvh-24px))] flex-col"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">
            {detail?.title ?? "排程预览"}
          </DialogTitle>
          {detail && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <ScheduleStatusTag status={detail.status} size="sm" />
              <span>
                {formatDate(detail.scheduleDate)}{" "}
                {getWeekDay(detail.scheduleDate)}
              </span>
              <span>{detail.store?.name ?? "—"}</span>
              <span>
                {detail.dishCount} 个菜品 / {detail.totalQuantity} 份
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState type="page" />
          ) : failed || !detail || !meta ? (
            <EmptyState
              icon={FileQuestion}
              title="排程单不存在"
              description="该单据可能已被删除，请返回列表刷新后再试。"
            />
          ) : (
            <>
              <PageTabs
                ariaLabel="排程预览内容"
                value={tab}
                onChange={(value) => setTab(value as QuickTab)}
                tabs={[
                  { value: "menu", label: "排程菜单", count: detail.items.length },
                  { value: "cutting", label: "切配工单", count: detail.cuttingOrders.length },
                  { value: "purchase", label: "采购计划", count: detail.purchasePlans.length },
                ]}
              />
              <div className="pt-4">
                {tab === "menu" && (
                  <ScheduleMenuTable items={detail.items} meta={meta} />
                )}
                {tab === "cutting" && (
                  <ScheduleCuttingTable rows={detail.cuttingOrders} meta={meta} />
                )}
                {tab === "purchase" && (
                  <SchedulePurchaseTable rows={detail.purchasePlans} meta={meta} />
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 pb-5 pt-4">
          <div className="flex w-full items-center justify-between">
            <div>
              {detail?.status === "进行中" && canWrite && (
                <SkeuButton
                  variant="ghost"
                  className="text-[#b42318] hover:bg-[#fdecea] hover:text-[#b42318]"
                  onClick={() => setVoidOpen(true)}
                >
                  <Ban className="h-4 w-4" />
                  作废
                </SkeuButton>
              )}
            </div>
            <SkeuButton
              onClick={() => detail && router.push(`/schedules/${detail.id}`)}
              disabled={!detail}
            >
              查看完整详情
            </SkeuButton>
          </div>
        </DialogFooter>

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
              <SkeuButton variant="danger" onClick={handleVoid} disabled={voiding}>
                {voiding ? "作废中…" : "确认作废"}
              </SkeuButton>
            </DialogFooter>
          </AppDialogContent>
        </Dialog>
      </AppDialogContent>
    </Dialog>
  );
}
