"use client";

import { useState } from "react";
import { getWeekDayShort } from "@/lib/shared/date-format";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { IndexCardListDialog } from "@/app/components/schedule/index-card-list-dialog";
import type { ScheduleListItem } from "@/app/components/schedule/list-types";

interface ScheduleCardProps {
  item: ScheduleListItem;
  busy?: boolean;
  /** 只读角色（如业务运营）不渲染写操作，只保留查看 */
  canWrite?: boolean;
  onOpen: () => void;
  /** 「查看详情」按钮：直进详情页（卡片点击仍走 onOpen 预览弹窗） */
  onViewDetail: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onGotoPlan: (planId: number) => void;
}

const PREVIEW_ROWS = 3;

/**
 * 排程索引卡：卡册舌 + 状态色头部 + 日期盒 + 前三道菜品预览。
 * 三态着色只落在舌片与头部，卡身保持中性纸面（data-status 驱动 CSS 变量）。
 */
export function ScheduleCard({
  item,
  busy = false,
  canWrite = false,
  onOpen,
  onViewDetail,
  onEdit,
  onActivate,
  onGotoPlan,
}: ScheduleCardProps) {
  const plan = item.productionPlan;
  const [moreOpen, setMoreOpen] = useState(false);

  const storeName = item.store?.name ?? item.title;
  const day = item.scheduleDate.slice(8, 10);
  const month = Number(item.scheduleDate.slice(5, 7));
  const weekday = getWeekDayShort(item.scheduleDate);
  const hiddenCount = Math.max(0, item.items.length - PREVIEW_ROWS);
  const visibleItems = item.items.slice(0, PREVIEW_ROWS);

  return (
    <article
      className="skeu-index-card self-start cursor-pointer"
      data-status={item.status}
      onClick={onOpen}
    >
      <span className="skeu-index-tab" aria-hidden />
      <span className="skeu-index-binding" aria-hidden>
        <span className="skeu-index-rings">
          {[0, 1, 2, 3, 4].map((ring) => (
            <span key={ring} className="skeu-index-ring" />
          ))}
        </span>
      </span>

      <div className="skeu-index-body flex min-h-0 flex-1 flex-col">
        <div className="skeu-index-head">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <span className="block text-xs font-bold tracking-[0.12em] text-muted-foreground">
                门店
              </span>
              <h3 className="mt-0.5 truncate text-xl leading-tight font-bold text-[color:var(--ic-head)]">
                {storeName}
              </h3>
            </div>
            <div className="skeu-datebox">
              <b className="text-[19px] leading-none font-bold tabular-nums">{day}</b>
              <span className="mt-0.5 text-xs font-bold">
                {month}月 · {weekday}
              </span>
            </div>
          </div>
        </div>

        <div className="skeu-index-list mt-2.5 min-h-0 flex-1">
          {visibleItems.map((row) => (
            <div
              key={row.dishId}
              className="grid h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--ic-row)]"
            >
              <span className="truncate text-[13px] font-semibold text-[color:var(--ic-body)]">
                {row.dish.name}
              </span>
              <span className="text-[13px] font-bold text-[color:var(--ic-head)] tabular-nums">
                {row.quantity}
                <small className="ml-0.5 text-xs font-normal text-muted-foreground">份</small>
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="flex h-[30px] items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                还有 {hiddenCount} 道
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMoreOpen(true);
                }}
                className="h-6 rounded-md px-1.5 text-xs font-bold text-[#77695a] transition-colors hover:bg-[#f4f0ea]"
              >
                查看更多
              </button>
            </div>
          )}
        </div>
      </div>

      <footer
        className="skeu-index-foot mt-2 flex min-h-[52px] items-center justify-between gap-2 border-t border-[color:var(--ic-row)] bg-white/55 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          <b className="text-base text-[color:var(--ic-head)]">{item.dishCount}</b> 菜 /{" "}
          <b className="text-base text-[color:var(--ic-head)]">{item.totalQuantity}</b> 份
        </span>
        <span className="flex items-center gap-1.5">
          {!canWrite && (
            <SkeuButton variant="outline" size="sm" onClick={onViewDetail}>
              查看详情
            </SkeuButton>
          )}
          {canWrite && item.status === "待生效" && (
            <>
              <SkeuButton variant="outline" size="sm" onClick={onEdit}>
                改菜单
              </SkeuButton>
              <SkeuActionButton
                label={busy ? "确认中..." : "确认菜单"}
                tone="primary"
                onClick={onActivate}
                disabled={busy}
              />
            </>
          )}
          {canWrite && item.status === "进行中" && plan && (
            <SkeuButton variant="outline" size="sm" onClick={() => onGotoPlan(plan.id)}>
              查看生产
            </SkeuButton>
          )}
          {canWrite && item.status === "进行中" && !plan && (
            <SkeuButton variant="outline" size="sm" disabled>
              等待排产
            </SkeuButton>
          )}
          {canWrite && item.status === "已完成" && (
            <SkeuButton variant="outline" size="sm" onClick={onViewDetail}>
              查看详情
            </SkeuButton>
          )}
        </span>
      </footer>
      <span className="skeu-index-tear" aria-hidden />
      <IndexCardListDialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="菜单明细"
        description={`${storeName} · 共 ${item.items.length} 道菜 / ${item.totalQuantity} 份`}
        rows={item.items.map((row) => ({
          key: String(row.dishId),
          label: row.dish.name,
          value: String(row.quantity),
        }))}
      />
    </article>
  );
}
