"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { cn } from "@/lib/shared/utils";

export function PageHeader({
  title,
  description,
  showBack = false,
  backHref,
  backLabel = "返回上一级",
  meta,
  actions,
  variant = "default",
  className,
}: {
  title: string;
  description?: ReactNode;
  showBack?: boolean;
  /** 提供固定返回路径时优先使用，避免浏览器历史栈不确定 */
  backHref?: string;
  backLabel?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  /** topbar 为固定顶栏形态（整宽白底 + 下边框），default 为页面内标题区 */
  variant?: "default" | "topbar";
  className?: string;
}) {
  const router = useRouter();
  const isTopbar = variant === "topbar";

  const goBack = () => (backHref ? router.push(backHref) : router.back());

  const backButton = showBack ? (
    isTopbar ? (
      <SkeuButton
        variant="outline"
        size="icon-sm"
        className="size-[38px] shrink-0 text-muted-foreground"
        onClick={goBack}
        title={backLabel}
        aria-label={backLabel}
      >
        <ArrowLeft className="h-5 w-5" />
      </SkeuButton>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        className="mt-0.5 shrink-0"
        onClick={goBack}
        title={backLabel}
        aria-label={backLabel}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
    )
  ) : null;

  return (
    <header
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
        isTopbar &&
          "items-center gap-3 border-b border-skeu-border skeu-surface px-4 py-4 shadow-sk-raised sm:px-6 lg:gap-4",
        className
      )}
    >
      <div className={cn("flex min-w-0 items-start gap-3", isTopbar && "lg:flex-1")}>
        {backButton}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className={cn(
                "font-bold tracking-tight",
                isTopbar ? "text-xl" : "text-2xl"
              )}
            >
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <div
              className={cn(
                "mt-1 text-muted-foreground",
                isTopbar && "text-[13px]"
              )}
            >
              {description}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div
          className={cn(
            "flex w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0 lg:justify-end",
            isTopbar && "w-auto flex-nowrap"
          )}
        >
          {actions}
        </div>
      )}
    </header>
  );
}