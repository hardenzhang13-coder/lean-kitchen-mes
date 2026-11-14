import type { ReactNode } from "react";
import { cn } from "@/lib/shared/utils";

interface PageShellProps {
  children: ReactNode;
  /** content 用于常规列表/详情，workspace 用于需要锁定高度的编辑工作台 */
  variant?: "content" | "workspace";
  className?: string;
}

export function PageShell({
  children,
  variant = "content",
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8",
        variant === "workspace" &&
          "min-h-dvh lg:h-dvh lg:min-h-0 lg:overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
