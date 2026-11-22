import type { ReactNode } from "react";

import { cn } from "@/lib/shared/utils";

/**
 * 详情内容分组：分组标题 + 组内信息单元。
 * 详情抽屉与详情页共用，避免各模块各写一套「基础信息 / 采购与计量」式分组。
 */

export function DetailSection({
  title,
  cols = 2,
  children,
}: {
  title: string;
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
}) {
  const colClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  }[cols];

  return (
    <section className="overflow-hidden rounded-xl border border-skeu-border bg-card skeu-surface shadow-sk-raised">
      <h3 className="skeu-surface-muted border-b border-skeu-border px-4 py-3 text-sm font-semibold">
        {title}
      </h3>
      <dl className={cn("grid gap-x-8 gap-y-5 p-4", colClass)}>
        {children}
      </dl>
    </section>
  );
}

export function InfoCell({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: string;
  value: ReactNode;
  /** 强调显示：用于价格、数量等核心字段 */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          "mt-1 break-words text-sm leading-6 " +
          (emphasis
            ? "font-semibold text-primary"
            : "font-medium text-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}
