import type { ReactNode } from "react";

/**
 * 详情内容分组：分组标题 + 组内双列信息单元。
 * 详情抽屉与详情页共用，避免各模块各写一套「基础信息 / 采购与计量」式分组。
 */

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h3 className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 p-4">{children}</dl>
    </section>
  );
}

export function InfoCell({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  /** 强调显示：用于价格、数量等核心字段 */
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
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
