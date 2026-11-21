import type { ReactNode } from "react";
import { cn } from "@/lib/shared/utils";

interface PageShellProps {
  children: ReactNode;
  /**
   * content 常规列表/详情（整页滚动）；
   * workspace 需要锁定高度的编辑工作台；
   * panel 固定框架：整宽顶栏 + 内容区唯一滚动，标准清单页使用。
   */
  variant?: "content" | "workspace" | "panel";
  /** panel 形态的固定顶栏，整宽显示，不随内容区滚动 */
  header?: ReactNode;
  className?: string;
}

export function PageShell({
  children,
  variant = "content",
  header,
  className,
}: PageShellProps) {
  if (variant === "panel") {
    return (
      <div
        className={cn(
          "flex min-h-dvh w-full min-w-0 flex-col lg:h-dvh lg:min-h-0 lg:overflow-hidden",
          className
        )}
      >
        {header}
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-6">
          {children}
        </div>
      </div>
    );
  }

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