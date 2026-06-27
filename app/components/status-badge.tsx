"use client";

import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  status?: string | null;
  variant?: StatusVariant;
  size?: "default" | "sm";
  className?: string;
}

const statusMap: Record<string, StatusVariant> = {
  // 结算/报销
  已结算: "success",
  待结算: "warning",
  已作废: "danger",
  已报销: "success",
  // 排程
  已发布: "success",
  待生效: "warning",
  进行中: "success",
  已完成: "neutral",
  已取消: "danger",
  // 库存流水
  入库: "success",
  出库: "danger",
  // 通用
  草稿: "neutral",
  已删除: "danger",
  正常: "success",
  未匹配: "warning",
  异常: "danger",
  // 采购来源
  手动: "info",
  AI: "neutral",
};

const inventoryStatusMap: Record<string, StatusVariant> = {
  充足: "success",
  正常: "warning",
  低库存: "danger",
};

const variantStyles: Record<StatusVariant, string> = {
  success:
    "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  warning:
    "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
  danger:
    "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  info:
    "bg-[var(--status-info-bg)] text-[var(--status-info)]",
  neutral:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
};

export function StatusBadge({ status, variant, size = "default", className }: StatusBadgeProps) {
  const resolved = variant || (status ? statusMap[status] : undefined) || "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        variantStyles[resolved],
        className
      )}
    >
      {status || "—"}
    </span>
  );
}

export function statusToVariant(status?: string | null): StatusVariant {
  return (status ? statusMap[status] : undefined) || "neutral";
}

export function inventoryStatusToVariant(status?: string | null): StatusVariant {
  return (status ? inventoryStatusMap[status] : undefined) || "neutral";
}
