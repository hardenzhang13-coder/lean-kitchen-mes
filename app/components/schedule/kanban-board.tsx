"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Clock, PlayCircle, type LucideIcon } from "lucide-react";

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
    hint: "已入库，仅可查看",
    text: "text-[var(--status-done-solid)]",
  },
};

const FALLBACK_STYLE: ColumnStyle = {
  icon: Clock,
  hint: "",
  text: "text-muted-foreground",
};

// Tailwind 需要静态类名，按可见列数映射栅格
const GRID_BY_COUNT: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
};

/**
 * 按状态分列的单据看板。列头用状态色文字与图标区分状态，列容器保持中性底色；
 * 列内纵向滚动，列头显示该状态总条数，超过取数上限时提示缩小筛选。
 * 展示哪几列由 `statuses` 决定，可见列数决定每行排布（3 / 2 / 1 列）。
 */
export function KanbanBoard<T>({
  statuses,
  columns,
  loading,
  renderItem,
  emptyText,
}: KanbanBoardProps<T>) {
  const columnByStatus = new Map(columns.map((column) => [column.status, column]));
  const gridClass = GRID_BY_COUNT[statuses.length] ?? "lg:grid-cols-3";

  return (
    <div className={`grid grid-cols-1 items-start gap-4 ${gridClass}`}>
      {statuses.map((status) => {
        const column = columnByStatus.get(status) ?? { status, items: [], total: 0 };
        const style = COLUMN_STYLES[status] ?? FALLBACK_STYLE;
        const Icon = style.icon;
        return (
          <section
            key={status}
            aria-label={`${status}单据`}
            className="overflow-hidden rounded-xl border bg-muted/20"
          >
            <header className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${style.text}`} />
                <span className={`text-sm font-semibold ${style.text}`}>{status}</span>
                <span className="ml-auto font-mono text-sm font-bold text-primary">
                  {column.total}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{style.hint}</p>
            </header>

            <div className="flex flex-col gap-3 p-3">
              {loading ? (
                [1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-40 animate-pulse rounded-xl bg-muted"
                  />
                ))
              ) : column.items.length === 0 ? (
                <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                  {emptyText}
                </p>
              ) : (
                column.items.map((item) => renderItem(item))
              )}

              {!loading && column.total > column.items.length && (
                <p className="px-1 text-xs text-muted-foreground">
                  仅显示前 {column.items.length} 张，请用搜索或日期缩小范围
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
