"use client";

import { cn } from "@/lib/shared/utils";
import {
  getScheduleStatusOption,
  scheduleStatusToVariant,
} from "@/lib/shared/schedule-status";
import type { ScheduleStatusVariant } from "@/lib/shared/schedule-status";

/** 与工作台周历一致的中色系实底色，白字 */
const SOLID_TONE: Record<ScheduleStatusVariant, string> = {
  warning: "bg-[var(--status-warning-solid)]",
  info: "bg-[var(--status-progress-solid)]",
  success: "bg-[var(--status-done-solid)]",
  neutral: "bg-[var(--status-neutral-solid)]",
};

interface ScheduleStatusTagProps {
  status?: string | null;
  size?: "sm" | "default";
  className?: string;
}

/** 排程 / 生产计划状态的唯一渲染入口。 */
export function ScheduleStatusTag({
  status,
  size = "default",
  className,
}: ScheduleStatusTagProps) {
  const label = getScheduleStatusOption(status)?.label ?? status ?? "—";
  const variant = scheduleStatusToVariant(status);

  return (
    <span
      className={cn(
        "skeu-badge inline-flex items-center whitespace-nowrap font-medium text-white",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs",
        SOLID_TONE[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
