"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Clock, PlayCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

interface KanbanColumn<T> {
  status: string;
  items: T[];
  total: number;
}

interface KanbanBoardProps<T> {
  /** 需要展示的状态列（按此顺序渲染，数量决定每行几列） */
  statuses: readonly string[];
  columns: KanbanColumn<T>[];
  loading: boolean;
  renderItem: (item: T) => ReactNode;
  /** 某列无数据时的提示 */
  emptyText: string;
}

interface ColumnStyle {
  icon: LucideIcon;
  hint: string;
  text: string;
}

const COLUMN_STYLES: Record<string, ColumnStyle> = {
  待生效: {
    icon: Clock,
    hint: "待确认，可改可删",
    text: "text-[var(--status-warning-solid)]",
  },
  进行中: {
    icon: PlayCircle,
    hint: "已确认，等待切配入库",
    text: "text-[var(--status-progress-solid)]",
  },
  已完成: {
    icon: CheckCircle2,
    hint: "已出库，仅可查看",
    text: "text-[var(--status-done-solid)]",
  },
};

const FALLBACK_STYLE: ColumnStyle = {
  icon: Clock,
  hint: "",
  text: "text-muted-foreground",
};

// Tailwind 需要静态类名：列跨距与列内卡片栅格按跨距映射
const COLUMN_SPAN_CLASS: Record<number, string> = {
  1: "",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};
const CARDS_GRID_CLASS: Record<number, string> = {
  1: "",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
};

/**
 * 状态列跨距规则（行固定 3 栅格，statuses 为枚举顺序子集）：
 * 三列全显各 1/3；关掉一列时，被关列的 workflow 上游邻列（枚举顺序循环左邻）扩为 2/3，
 * 列内卡片同步两列平铺；只剩一列时撑满整行，卡片三列平铺。
 */
function computeColumnSpans(statuses: readonly string[]): Map<string, number> {
  const spans = new Map<string, number>();
  if (statuses.length === 1) {
    spans.set(statuses[0], 3);
    return spans;
  }
  if (statuses.length !== 2) return spans;
  const hidden = SCHEDULE_STATUS_VALUES.filter((status) => !statuses.includes(status));
  if (hidden.length === 1) {
    const length = SCHEDULE_STATUS_VALUES.length;
    const hiddenIndex = SCHEDULE_STATUS_VALUES.indexOf(hidden[0]);
    const wide =
      SCHEDULE_STATUS_VALUES[(hiddenIndex - 1 + length) % length];
    spans.set(statuses.includes(wide) ? wide : statuses[1], 2);
  } else {
    spans.set(statuses[1], 2);
  }
  return spans;
}

/**
 * 按状态分列的单据看板。列头用状态色文字与图标区分状态，列容器保持中性底色；
 * 列内纵向滚动，列头显示该状态总条数，超过取数上限时提示缩小筛选。
 * 展示哪几列由 `statuses` 决定（枚举顺序子集）；行固定 3 栅格，
 * 关一列时被关列的上游邻列扩为 2/3（卡片两列平铺），只剩一列时撑满整行（卡片三列平铺）。
 */
export function KanbanBoard<T>({
  statuses,
  columns,
  loading,
  renderItem,
  emptyText,
}: KanbanBoardProps<T>) {
  const columnByStatus = new Map(columns.map((column) => [column.status, column]));
  const spans = computeColumnSpans(statuses);

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3">
      {statuses.map((status) => {
        const column = columnByStatus.get(status) ?? { status, items: [], total: 0 };
        const style = COLUMN_STYLES[status] ?? FALLBACK_STYLE;
        const Icon = style.icon;
        const span = spans.get(status) ?? 1;
        return (
          <section
            key={status}
            aria-label={`${status}单据`}
            className={cn(
              "skeu-panel flex min-h-0 flex-col overflow-hidden",
              COLUMN_SPAN_CLASS[span]
            )}
          >
            <header className="skeu-panel-toolbar flex items-center gap-2 px-4 py-3">
              <Icon className={`h-4 w-4 ${style.text}`} />
              <span className={`text-sm font-bold ${style.text}`}>{status}</span>
              <span className="ml-auto grid h-[22px] min-w-[26px] place-items-center rounded-full border border-skeu-border bg-white px-1.5 text-xs font-bold tabular-nums">
                {column.total}
              </span>
            </header>

            <div className="skeu-panel-body skeu-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
              <div className={cn("grid grid-cols-1 gap-3", CARDS_GRID_CLASS[span])}>
                {loading ? (
                  [1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-40 animate-pulse rounded-xl bg-muted"
                    />
                  ))
                ) : column.items.length === 0 ? (
                  <p className="col-span-full rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                    {emptyText}
                  </p>
                ) : (
                  column.items.map((item) => renderItem(item))
                )}
              </div>

              {!loading && column.total > column.items.length && (
                <p className="mt-3 px-1 text-xs text-muted-foreground">
                  仅显示前 {column.items.length} 张，请用搜索或日期缩小范围
                </p>
              )}
            </div>

            <footer className="skeu-panel-toolbar px-4 py-2 text-xs text-muted-foreground">
              {style.hint}
            </footer>
          </section>
        );
      })}
    </div>
  );
}
