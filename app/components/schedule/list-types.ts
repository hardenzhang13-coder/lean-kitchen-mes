import type {
  CuttingOrderRow,
  ScheduleDocMeta,
} from "@/app/components/schedule/schedule-cutting-table";
import type { PurchasePlanRow } from "@/app/components/schedule/schedule-purchase-table";
import type { ScheduleMenuItem } from "@/app/components/schedule/schedule-menu-table";
import type { ProductionPlanSourceSnapshot } from "@/lib/shared/production-plan";

export type { CuttingOrderRow, PurchasePlanRow, ScheduleDocMeta, ScheduleMenuItem };

export interface PlanRef {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
}

export interface ScheduleListItem {
  id: number;
  title: string;
  scheduleDate: string;
  store: { id: number; name: string } | null;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  dishCount: number;
  totalQuantity: number;
  items: Array<{
    dishId: number;
    quantity: number;
    dish: { id: number; name: string; code: string };
  }>;
  productionPlan: PlanRef | null;
}

export interface ProductionPlanListItem {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  scheduleCount: number;
  selfOrderCount: number;
  remark: string | null;
  categoryCount: number;
  totalPortions: number;
  /** 卡片中间区：来源门店 + 需求份数（取自来源快照，纯手工计划为空数组） */
  stores: Array<{ name: string; portions: number }>;
}

export interface SelfProductionOrderListItem {
  id: number;
  code: string | null;
  title: string;
  produceDate: string;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  remark: string | null;
  itemCount: number;
  totalPortions: number;
  productionPlan: PlanRef | null;
}

export interface ScheduleQuickDetail {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
  store: { id: number; name: string } | null;
  items: ScheduleMenuItem[];
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  totalQuantity: number;
  dishCount: number;
  productionPlan: PlanRef | null;
}

export interface ProductionPlanSourceSchedule {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  totalQuantity: number;
  status?: string;
  store?: { id: number; name: string };
}

export interface ProductionPlanPreviewSelfOrder {
  id: number;
  code: string | null;
  title: string;
  produceDate: string;
  status: string;
  remark: string | null;
  totalPortions: number;
}

export interface ProductionPlanPreview {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
  operator: string | null;
  operatorName: string | null;
  createdAt: string;
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  sourceSchedules: ProductionPlanSourceSchedule[];
  selfOrders?: ProductionPlanPreviewSelfOrder[];
  sourceSnapshot?: ProductionPlanSourceSnapshot;
}

export type QuickTab = "menu" | "cutting" | "purchase";
export type PlanPreviewTab = "cutting" | "purchase" | "stores" | "self";
