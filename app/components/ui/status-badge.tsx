"use client";

import { cn } from "@/lib/shared/utils";

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
  已停用: "warning",
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
  // 采购来源
  手动: "info",
  AI: "neutral",
};

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-[var(--status-success-bg)] text-[#15803D]",
  warning: "bg-[var(--status-warning-bg)] text-[#D97706]",
  danger: "bg-[var(--status-danger-bg)] text-[#DC2626]",
  info: "bg-[var(--status-info-bg)] text-[#2563EB]",
  neutral: "bg-[var(--status-neutral-bg)] text-[#6B7280]",
};

/** 徽章圆点用更亮的语义色，与文字色区分 */
const dotStyles: Record<StatusVariant, string> = {
  success: "bg-[#22C55E]",
  warning: "bg-[#F59E0B]",
  danger: "bg-[#EF4444]",
  info: "bg-[#3B82F6]",
  neutral: "bg-[#6B7280]",
};

export function StatusBadge({ status, variant, size = "default", className }: StatusBadgeProps) {
  const resolved = variant || (status ? statusMap[status] : undefined) || "neutral";
  return (
    <span
      className={cn(
        "skeu-badge inline-flex items-center whitespace-nowrap",
        size === "sm" ? "h-5 gap-1 px-1.5 text-xs" : "h-[26px] gap-1.5 px-2.5 text-xs",
        variantStyles[resolved],
        className
      )}
    >
      <span className={cn("dot", dotStyles[resolved])} aria-hidden />
      {status || "—"}
    </span>
  );
}

export function statusToVariant(status?: string | null): StatusVariant {
  return (status ? statusMap[status] : undefined) || "neutral";
}

