import type { StatusVariant } from "@/app/components/ui/status-badge";

// 库存状态 → 徽章配色映射（库存领域逻辑，从通用 status-badge 抽出，避免领域逻辑泄漏进通用组件）。

const inventoryStatusMap: Record<string, StatusVariant> = {
  充足: "success",
  正常: "warning",
  低库存: "danger",
};

export function inventoryStatusToVariant(status?: string | null): StatusVariant {
  return (status ? inventoryStatusMap[status] : undefined) || "neutral";
}
