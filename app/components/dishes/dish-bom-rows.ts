import {
  BomType,
  DishDetail,
  calcCost,
  netSpecText,
} from "@/app/components/dish-form/types";

export interface DishBomRow {
  id: string;
  type: BomType;
  name: string;
  spec: string | null;
  productName: string | null;
  amountG: string | number | null;
  /** 份量：净料/小料口径，调料与酱料恒为空 */
  portion: string | null;
  cost: number | null;
}

/**
 * 菜品 BOM 明细 → 展示行（列表抽屉与详情页共用）。
 * 成本按当前食材价格实时重算，避免原料调价后展示历史 BOM 行成本。
 */
export function buildDishBomRows(dish: DishDetail): DishBomRow[] {
  return [
    ...(dish.netDetails?.filter((d) => d.role === "main").map((d, idx) => ({
      id: `main-${idx}`,
      type: "main" as BomType,
      name: d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, d.spec),
      productName: null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("main", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.netDetails?.filter((d) => d.role === "support").map((d, idx) => ({
      id: `support-${idx}`,
      type: "support" as BomType,
      name: d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, d.spec),
      productName: null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("support", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.minorDetails?.map((d, idx) => ({
      id: `minor-${idx}`,
      type: "minor" as BomType,
      name: d.name || d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, null),
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("minor", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.seasoningDetails?.map((d, idx) => ({
      id: `seasoning-${idx}`,
      type: "seasoning" as BomType,
      name: d.name || "—",
      spec: d.spec ?? null,
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: d.portion ?? null,
      cost: calcCost("seasoning", d.pricePerJin, d.amountG),
    })) ?? []),
    ...(dish.sauceDetails?.map((d, idx) => ({
      id: `sauce-${idx}`,
      type: "sauce" as BomType,
      name: d.sauce?.name || "—",
      spec: null,
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: null,
      cost: calcCost("sauce", d.sauce?.outPricePerJin, d.amountG),
    })) ?? []),
  ];
}

/** BOM 行成本合计（行成本缺失按 0 计） */
export function sumDishBomCost(rows: DishBomRow[]): number {
  return Number(rows.reduce((sum, row) => sum + (row.cost ?? 0), 0).toFixed(4));
}
