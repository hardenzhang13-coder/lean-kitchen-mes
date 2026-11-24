/**
 * 排程 / 生产计划状态枚举（前后端共用，唯一真源）。
 *
 * 状态值由排程与生产计划共用；两者的「已完成」触发动作不同。
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
    description: "已确认；生产完成后保持进行中，直到门店出库完成",
    variant: "info",
  },
  {
    value: "已完成",
    label: "已完成",
    description: "排程由出库完成回写；生产计划由完成生产回写",
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
