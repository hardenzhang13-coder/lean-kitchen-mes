"use client";

import { StatusBadge } from "./status-badge";
import { getDishStatusOption } from "@/lib/shared/dish-status";

/**
 * 菜品状态标签：菜品状态枚举的唯一渲染入口。
 * 状态取值与配色语义来自 `lib/shared/dish-status.ts`，不在页面里手写映射。
 */
export function DishStatusTag({
  status,
  size = "default",
  className,
}: {
  status?: string | null;
  size?: "default" | "sm";
  className?: string;
}) {
  const option = getDishStatusOption(status);
  return (
    <StatusBadge
      status={option?.label ?? status}
      variant={option?.variant}
      size={size}
      className={className}
    />
  );
}
