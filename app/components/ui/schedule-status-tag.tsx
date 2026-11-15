"use client";

import {
  getScheduleStatusOption,
  scheduleStatusToVariant,
} from "@/lib/shared/schedule-status";
import { StatusBadge } from "@/app/components/ui/status-badge";

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
    <StatusBadge status={label} variant={variant} size={size} className={className} />
  );
}
