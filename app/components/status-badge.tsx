"use client";

import { cn } from "@/lib/utils";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  status?: string | null;
  variant?: StatusVariant;
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
  进行中: "info",
  已完成: "success",
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
};

const variantStyles: Record<StatusVariant, string> = {
  success:
    "bg-[var(--success-muted)] text-[var(--success)]",
  warning:
    "bg-[var(--warning-muted)] text-[var(--warning)]",
  danger:
    "bg-[var(--danger-muted)] text-[var(--danger)]",
  info:
    "bg-[var(--info-muted)] text-[var(--info)]",
  neutral:
    "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolved = variant || (status ? statusMap[status] : undefined) || "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
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
