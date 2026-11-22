import type { ReactNode } from "react";
import { cn } from "@/lib/shared/utils";

/** 弱化的编号 / 编码字段：等宽、小一号、低对比，不与名称抢层级 */
export function CodeText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[12px] font-normal tracking-tight text-muted-foreground/70",
        className
      )}
    >
      {children}
    </span>
  );
}
