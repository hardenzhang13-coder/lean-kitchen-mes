"use client";

import Link from "next/link";
import { Inbox, LucideIcon } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { cn } from "@/lib/shared/utils";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction | React.ReactNode;
  className?: string;
  /** danger 用于加载失败/异常态，图标转为危险色 */
  tone?: "default" | "danger";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone = "default",
}: EmptyStateProps) {
  const Icon = icon ?? Inbox;

  const actionNode = (() => {
    if (!action) return null;
    if (typeof action !== "object" || !("label" in action)) return action;
    const { label, href, onClick } = action as EmptyStateAction;
    if (href) {
      return (
        <SkeuButton variant="primary" render={<Link href={href} />}>
          {label}
        </SkeuButton>
      );
    }
    return (
      <SkeuButton variant="primary" onClick={onClick}>
        {label}
      </SkeuButton>
    );
  })();

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden px-6 py-20 text-center",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-10 h-28 w-28 -translate-x-1/2 rounded-full border border-primary/[0.06]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 h-40 w-40 -translate-x-1/2 rounded-full border border-primary/[0.03]"
      />

      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-[18px] border border-skeu-border skeu-surface shadow-[var(--sk-highlight-top),var(--sk-shadow-1)]" />
        <span className="absolute inset-[3px] rounded-[15px] bg-[var(--sk-surface-muted)] shadow-[var(--sk-inset)]" />
        <Icon
          className={cn(
            "relative h-6 w-6",
            tone === "danger" ? "text-destructive" : "text-muted-foreground"
          )}
          strokeWidth={1.8}
        />
      </div>

      <h3 className="relative text-[15px] font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="relative mt-1.5 max-w-[320px] text-[13px] leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {actionNode ? <div className="relative mt-5">{actionNode}</div> : null}
    </div>
  );
}
