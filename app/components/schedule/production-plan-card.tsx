"use client";

import { useState } from "react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { IndexCardListDialog } from "@/app/components/schedule/index-card-list-dialog";
import { getWeekDayShort } from "@/lib/shared/date-format";
import { formatPortionsValue } from "@/lib/shared/prepped-stock";
import type { ProductionPlanListItem } from "@/app/components/schedule/list-types";

const PREVIEW_ROWS = 3;

interface ProductionPlanCardProps {
  item: ProductionPlanListItem;
  busy?: boolean;
  /** 只读角色（如业务运营）不渲染写操作，只保留查看 */
  canWrite?: boolean;
  onOpen: () => void;
  /** 「查看详情」按钮：直进详情页（卡片点击仍走 onOpen 预览弹窗） */
  onViewDetail: () => void;
  onEdit: () => void;
  onActivate: () => void;
  onComplete: () => void;
}

/**
 * 切配计划单索引卡：卡册舌 + 状态色头部 + 生产日期日期盒 + 门店份数明细区。
 * 头部名称位为编号简称（编号即简称），日期盒与排菜模块同构（生产日期：日 + 月·周几）；
 * 中间区与排菜卡同构：按来源门店逐行「门店名 + 需求份数」，超出 3 行可展开；
 * 纯手工计划（无来源门店）回退展示备注。卡高自适应内容，不留大空白。
 */
export function ProductionPlanCard({
  item,
  busy = false,
  canWrite = false,
  onOpen,
  onViewDetail,
  onEdit,
  onActivate,
  onComplete,
}: ProductionPlanCardProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const day = item.planDate.slice(8, 10);
  const month = Number(item.planDate.slice(5, 7));
  const weekday = getWeekDayShort(item.planDate);
  const storeRows = item.stores ?? [];
  const hiddenCount = Math.max(0, storeRows.length - PREVIEW_ROWS);
  const visibleStores = storeRows.slice(0, PREVIEW_ROWS);

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
                切配中心
              </span>
              <h3 className="mt-0.5 truncate font-mono text-xl leading-tight font-bold text-[color:var(--ic-head)]">
                {item.code ?? `#${item.id}`}
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

        <div className="skeu-index-list mt-2.5 flex min-h-0 flex-1 flex-col">
          {storeRows.length === 0 ? (
            <p className="text-[13px] leading-relaxed font-semibold break-all text-[color:var(--ic-body)]">
              {item.remark?.trim() || "纯手工切配计划"}
            </p>
          ) : (
            <>
              {visibleStores.map((row) => (
                <div
                  key={row.name}
                  className="grid h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--ic-row)]"
                >
                  <span className="truncate text-[13px] font-semibold text-[color:var(--ic-body)]">
                    {row.name}
                  </span>
                  <span className="text-[13px] font-bold text-[color:var(--ic-head)] tabular-nums">
                    {formatPortionsValue(row.portions)}
                    <small className="ml-0.5 text-xs font-normal text-muted-foreground">份</small>
                  </span>
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="flex h-[30px] items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">
                    还有 {hiddenCount} 家门店
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
              {item.remark?.trim() && (
                <p className="mt-auto pt-2 text-xs font-semibold break-all text-muted-foreground">
                  {item.remark.trim()}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <footer
        className="skeu-index-foot mt-2 flex min-h-[52px] items-center justify-between gap-2 border-t border-[color:var(--ic-row)] bg-white/55 py-2"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          <b className="text-base text-[color:var(--ic-head)]">{item.categoryCount}</b> 类 /{" "}
          <b className="text-base text-[color:var(--ic-head)]">
            {formatPortionsValue(item.totalPortions)}
          </b>{" "}
          份
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
                编辑
              </SkeuButton>
              <SkeuActionButton
                label={busy ? "确认中..." : "确认生产"}
                tone="primary"
                onClick={onActivate}
                disabled={busy}
              />
            </>
          )}
          {canWrite && item.status === "进行中" && (
            <SkeuActionButton
              label={busy ? "加载中..." : "完成切配"}
              tone="primary"
              onClick={onComplete}
              disabled={busy}
            />
          )}
          {canWrite && item.status === "已完成" && (
            <SkeuButton variant="outline" size="sm" onClick={onViewDetail} disabled={busy}>
              查看详情
            </SkeuButton>
          )}
        </span>
      </footer>
      <span className="skeu-index-tear" aria-hidden />
      <IndexCardListDialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="来源门店明细"
        description={`${item.code ?? `#${item.id}`} · 共 ${storeRows.length} 家门店 / ${formatPortionsValue(item.totalPortions)} 份`}
        rows={storeRows.map((row) => ({
          key: row.name,
          label: row.name,
          value: formatPortionsValue(row.portions),
        }))}
      />
    </article>
  );
}
