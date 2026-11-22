import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/shared/utils";

export interface EntryCardProps {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}

/** 设置 / hub 页入口卡：暖白纸面 + 内凹图标磁贴，hover 轻微上浮 */
export function EntryCard({
  href,
  label,
  description,
  icon: Icon,
  className,
}: EntryCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group/card relative flex min-h-[112px] items-start gap-4 rounded-xl border border-skeu-border bg-white p-4 shadow-sk-panel transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-sk-3 active:translate-y-0 active:shadow-sk-inset",
        className
      )}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-skeu-border bg-[var(--sk-control-bg)] text-muted-foreground shadow-sk-inset transition-colors duration-150 group-hover/card:border-primary/40 group-hover/card:bg-[var(--sk-primary-soft-solid)] group-hover/card:text-primary">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            {label}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform duration-150 group-hover/card:translate-x-0.5 group-hover/card:text-primary" />
        </span>
        <span className="mt-1.5 block text-[13px] leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
