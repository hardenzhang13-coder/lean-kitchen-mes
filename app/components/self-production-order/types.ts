export interface SelfProductionItemDetail {
  id: number;
  sourceType: string;
  sourceId: number;
  itemCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  l2Code: string;
  packageSpec: number | null;
  unit: string;
  yieldRate: number | null;
  portions: number;
  requiredQty: number | null;
  grossNeed: number | null;
  grossNeedJin: number | null;
}

export interface SelfProductionPlanRef {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
}

export interface SelfProductionOrderDetail {
  id: number;
  code: string | null;
  title: string;
  produceDate: string;
  status: string;
  operator: string | null;
  operatorName: string | null;
  remark: string | null;
  createdAt: string;
  items: SelfProductionItemDetail[];
  productionPlan: SelfProductionPlanRef | null;
}
