/**
 * 菜品转化计划（前后端共用类型）。
 *
 * 转化时会同步把 BOM 引用的净料/小料切换到目标份量规格：
 * - 食材库已有「同切法 + 规格 = 源×倍率」的目标规格 → 直接复用
 * - 没有（含切法不同、规格不符）→ 按倍率推导封装规格，由用户确认后自动建档
 */

export type DishScaleSpecKind = "net" | "minor";

export type DishScaleSpecStatus = "existing" | "missing";

export type DishScaleProposal = {
  name: string;
  /** 目标封装规格（g），按源封装规格 × 份量倍率推导 */
  packageSpec: number;
  yieldRate: number;
  processingFeePerJin: number | null;
  grossMarginRate: number | null;
  portion: string;
};

export type DishScaleSpecPlan = {
  kind: DishScaleSpecKind;
  /** 源菜品 BOM 引用的净料/小料 id */
  sourceNetIngId: number;
  sourceName: string;
  sourceCode: string;
  sourcePortion: string | null;
  sourcePackageSpec: number | null;
  l2Code: string;
  sourceIngredientId: number | null;
  sourceIngredientName: string | null;
  sourceIngredientPricePerJin: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  storage: string | null;
  /** 缺少来源原料时无法自动建档 */
  canCreate: boolean;
  status: DishScaleSpecStatus;
  existing?: {
    id: number;
    code: string;
    name: string;
    packageSpec: number | null;
    portion: string | null;
  };
  proposal: DishScaleProposal;
};

export type DishScalePlan = {
  factor: number;
  targetPortion: string;
  net: DishScaleSpecPlan[];
  minor: DishScaleSpecPlan[];
};

export type DishScaleSpecInput = {
  kind: DishScaleSpecKind;
  sourceNetIngId: number;
  name: string;
  packageSpec: number;
  yieldRate: number;
  processingFeePerJin: number | null;
  grossMarginRate: number | null;
};
