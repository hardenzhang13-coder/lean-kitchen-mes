"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Clock, PlayCircle, type LucideIcon } from "lucide-react";

interface KanbanColumn<T> {
  status: string;
  items: T[];
  total: number;
}

interface KanbanBoardProps<T> {
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
    text: "text-[var(--status-warning)]",
  },
  进行中: {
    icon: PlayCircle,
    hint: "已确认，等待切配入库",
    text: "text-[var(--status-info)]",
  },
  已完成: {
    icon: CheckCircle2,
    hint: "已入库，仅可查看",
    text: "text-[var(--status-success)]",
  },
};

const FALLBACK_STYLE: ColumnStyle = {
  icon: Clock,
  hint: "",
  text: "text-muted-foreground",
};

/**
 * 按状态三列的单据看板。列头用状态色文字与图标区分状态，列容器保持中性底色；
 * 列内纵向滚动，列头显示该状态总条数，超过取数上限时提示缩小筛选。
 */
export function KanbanBoard<T>({
  columns,
  loading,
  renderItem,
  emptyText,
}: KanbanBoardProps<T>) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
      {columns.map((column) => {
        const style = COLUMN_STYLES[column.status] ?? FALLBACK_STYLE;
        const Icon = style.icon;
        return (
          <section
            key={column.status}
            aria-label={`${column.status}单据`}
            className="overflow-hidden rounded-xl border bg-muted/20"
          >
            <header className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${style.text}`} />
                <span className={`text-sm font-semibold ${style.text}`}>
                  {column.status}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
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
