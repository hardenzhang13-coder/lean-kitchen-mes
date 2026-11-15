/**
 * 排程 / 生产计划状态枚举（前后端共用，唯一真源）。
 *
 * 两张单据共用同一套三态：待生效 → 进行中 → 已完成。
 * 落库为中文短值，`label` 只用于展示；渲染入口见
 * `app/components/ui/schedule-status-tag.tsx`。
 */

export const SCHEDULE_STATUS_VALUES = ["待生效", "进行中", "已完成"] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUS_VALUES)[number];

export type ScheduleStatusVariant = "warning" | "info" | "success" | "neutral";

export interface ScheduleStatusOption {
  value: ScheduleStatus;
  label: string;
  description: string;
  variant: ScheduleStatusVariant;
}

export const SCHEDULE_STATUS_OPTIONS: readonly ScheduleStatusOption[] = [
  {
    value: "待生效",
    label: "待生效",
    description: "可修改、可删除、可确认生产",
    variant: "warning",
  },
  {
    value: "进行中",
    label: "进行中",
    description: "已确认，可纳入生产计划单；不可修改或删除",
    variant: "info",
  },
  {
    value: "已完成",
    label: "已完成",
    description: "生产计划单完成生产后自动回写，终态",
    variant: "success",
  },
] as const;

export function getScheduleStatusOption(
  status?: string | null
): ScheduleStatusOption | null {
  if (!status) return null;
  return SCHEDULE_STATUS_OPTIONS.find((option) => option.value === status) ?? null;
}

export function isValidScheduleStatus(
  status: unknown
): status is ScheduleStatus {
  return (
    typeof status === "string" &&
    (SCHEDULE_STATUS_VALUES as readonly string[]).includes(status)
  );
}

export function scheduleStatusToVariant(
  status?: string | null
): ScheduleStatusVariant {
  return getScheduleStatusOption(status)?.variant ?? "neutral";
}
