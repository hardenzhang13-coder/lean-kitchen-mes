// 净菜库存（prepped stock）共享类型与纯函数（前端/后端共用）。
// 业务口径见 memory-bank/v002-净菜库存管理-方案.md：
// - 库存对象 = 净菜（食材库净料 net + 小料 minor，同表 net_ingredients，sourceType 区分）
// - 按份出入库：份为记账主单位，g 按当时封装规格换算同步累加
// - 生产计划单 cuttingJson 行在完成生产确认时演进 confirmStatus / actualPortions / remark

/** 生产计划单 cuttingJson 行（AggregatedCutting + 完成确认态） */
export interface PlanCuttingRow {
  sourceType: string; // net / minor
  sourceId: number;
  sourceCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  packageSpec: number | null;
  requiredQty: number; // g
  unit: string;
  portions: number | null; // 计划份数 = requiredQty ÷ packageSpec
  portionsText: string | null;
  grossNeedJin: number | null;
  // 完成生产确认态（v002，快照内演进）
  confirmStatus?: "pending" | "completed" | "unfinished";
  actualPortions?: number | null;
  remark?: string | null;
}

export type PlanCuttingConfirmStatus = "pending" | "completed" | "unfinished";

export const PLAN_ROW_PENDING = "pending" as const;

export type OutboundDisplayStatus = "unshipped" | "partial" | "shipped";

export const OUTBOUND_STATUS_LABEL: Record<OutboundDisplayStatus, string> = {
  unshipped: "未出库",
  partial: "部分出库",
  shipped: "已出库",
};

/** 行确认态归一（兼容历史快照无 confirmStatus 字段） */
export function rowConfirmStatus(row: PlanCuttingRow): PlanCuttingConfirmStatus {
  return row.confirmStatus ?? "pending";
}

/** round2 统一口径（与 production-plan-utils 一致） */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 份数展示：整数 "N 份"，一位小数 "N.N 份" */
export function formatPortionsCount(portions: number): string {
  const p = Math.round(portions * 10) / 10;
  return (Number.isInteger(p) ? String(p) : p.toFixed(1)) + " 份";
}

/** 份数数值展示（不带单位）：整数 "N"，一位小数 "N.N" */
export function formatPortionsValue(portions: number): string {
  const p = Math.round(portions * 10) / 10;
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

/** 出库行展示状态：按计划出库数与本单实际出库数比较得出。 */
export function getOutboundDisplayStatus(
  requiredPortions: number,
  shippedPortions: number
): OutboundDisplayStatus {
  const required = round2(requiredPortions);
  const shipped = round2(shippedPortions);
  if (shipped <= 0) return "unshipped";
  if (shipped < required) return "partial";
  return "shipped";
}

/** 行金额（元）= 出库价（元/斤）× 出库量 g ÷ 500 */
export function calcLineAmount(outPricePerJin: number, shippedQtyG: number): number {
  return round2((outPricePerJin * shippedQtyG) / 500);
}
