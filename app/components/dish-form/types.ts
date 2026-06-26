export type BomType = "main" | "support" | "minor" | "seasoning" | "sauce";

export interface BomItem {
  id: string;
  sourceId: number;
  name: string;
  productName?: string | null;
  spec?: string | null;
  amountG: string;
  unitPrice: number;
  unit: string;
  cost?: number | null;
}

export type ProcessStage = "初加工" | "预处理" | "上灶加工" | "出锅成品";

export interface ProcessStep {
  stage: ProcessStage;
  stepNo: number;
  object: string;
  action: string;
  description?: string | null;
  tool?: string | null;
  standard?: string | null;
}

export interface DishFormData {
  name: string;
  intro: string;
  categoryId: string;
  cuisine: string;
  technique: string;
  taste: string;
  portion: string;
  season: string;
  meatType: string;
}

export interface IngredientOption {
  id: number;
  code: string;
  name: string;
  productName?: string | null;
  spec?: string | null;
  unitPrice: number | null;
  unit: string | null;
  l1Code?: string;
  l2Code?: string;
}

export interface IngredientCategory {
  code: string;
  name: string;
  children?: Array<{ code: string; name: string; parentCode: string }>;
}

export interface DishFormRefs {
  categories: Array<{ id: number; code: string; name: string }>;
  netIngredients: IngredientOption[];
  minorIngredients: IngredientOption[];
  seasonings: IngredientOption[];
  sauces: IngredientOption[];
  ingredientCategories: IngredientCategory[];
}

export const BOM_TYPE_LABELS: Record<BomType, string> = {
  main: "主料",
  support: "辅料",
  minor: "小料",
  seasoning: "调料",
  sauce: "酱料",
};

export const BOM_TYPE_REQUIRED: Record<BomType, boolean> = {
  main: true,
  support: true,
  minor: true,
  seasoning: true,
  sauce: false,
};

export const VALID_STAGES: ProcessStage[] = ["初加工", "预处理", "上灶加工", "出锅成品"];

export const TOOL_OPTIONS = [
  { value: "人工", label: "人工" },
  { value: "刀具", label: "刀具" },
  { value: "炉灶", label: "炉灶" },
  { value: "烤箱", label: "烤箱" },
  { value: "蒸锅", label: "蒸锅" },
  { value: "搅拌机", label: "搅拌机" },
  { value: "其他", label: "其他" },
];

export const STAGE_ORDER: Record<ProcessStage, number> = {
  "初加工": 0,
  "预处理": 1,
  "上灶加工": 2,
  "出锅成品": 3,
};

export interface DishDetail {
  id: number;
  code: string;
  name: string;
  intro: string | null;
  categoryId: number;
  category?: { id: number; code: string; name: string } | null;
  cuisine?: string | null;
  technique?: string | null;
  taste?: string | null;
  portion?: string | null;
  season?: string | null;
  meatType?: string | null;
  cost?: number | null;
  status: string;
  createdAt?: string | Date;
  netDetails?: Array<{
    role?: string;
    netIngId: number;
    amountG: number | string;
    spec?: string | null;
    cost?: number | null;
    netIngredient?: { id: number; code: string; name: string; unitPrice: number | null; unit: string | null } | null;
  }>;
  minorDetails?: Array<{
    netIngId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    name?: string;
    unitPrice?: number | null;
    unit?: string | null;
  }>;
  seasoningDetails?: Array<{
    sourceId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    name?: string;
    unitPrice?: number | null;
    unit?: string | null;
  }>;
  sauceDetails?: Array<{
    sauceId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    sauce?: { id: number; code: string; name: string; unitPrice: number | null; unit: string | null } | null;
  }>;
  processes?: Array<ProcessStep>;
}

export function dishToFormData(dish: DishDetail): DishFormData {
  return {
    name: dish.name || "",
    intro: dish.intro || "",
    categoryId: dish.categoryId ? String(dish.categoryId) : "",
    cuisine: dish.cuisine || "",
    technique: dish.technique || "",
    taste: dish.taste || "",
    portion: dish.portion || "正餐份量",
    season: dish.season || "四季",
    meatType: dish.meatType || "",
  };
}

export function emptyBom(): Record<BomType, BomItem[]> {
  return { main: [], support: [], minor: [], seasoning: [], sauce: [] };
}

export function dishToBom(
  dish: DishDetail,
  refs: {
    netIngredients: IngredientOption[];
    minorIngredients: IngredientOption[];
    seasonings: IngredientOption[];
    sauces: IngredientOption[];
  }
): Record<BomType, BomItem[]> {
  const findNet = (id: number) =>
    refs.netIngredients.find((i) => i.id === id) || refs.minorIngredients.find((i) => i.id === id);
  const findSeasoning = (id: number) => refs.seasonings.find((i) => i.id === id);
  const findSauce = (id: number) => refs.sauces.find((i) => i.id === id);

  const bom = emptyBom();

  dish.netDetails?.forEach((d) => {
    const ing = findNet(d.netIngId);
    if (!ing) return;
    const item: BomItem = {
      id: `net-${d.netIngId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.netIngId,
      name: ing.name,
      spec: ing.spec,
      amountG: String(d.amountG),
      unitPrice: ing.unitPrice ?? 0,
      unit: ing.unit || "g",
      cost: d.cost != null ? Number(d.cost) : calcCost(ing.unitPrice ?? 0, d.amountG),
    };
    if (d.role === "support") bom.support.push(item);
    else bom.main.push(item);
  });

  dish.minorDetails?.forEach((d) => {
    const ing = findNet(d.netIngId);
    if (!ing) return;
    bom.minor.push({
      id: `minor-${d.netIngId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.netIngId,
      name: ing.name,
      productName: d.brand || ing.productName,
      spec: ing.spec,
      amountG: String(d.amountG),
      unitPrice: ing.unitPrice ?? 0,
      unit: ing.unit || "g",
      cost: d.cost != null ? Number(d.cost) : calcCost(ing.unitPrice ?? 0, d.amountG),
    });
  });

  dish.seasoningDetails?.forEach((d) => {
    const ing = findSeasoning(d.sourceId);
    if (!ing) return;
    bom.seasoning.push({
      id: `sea-${d.sourceId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.sourceId,
      name: ing.name,
      productName: d.brand || ing.productName,
      spec: ing.spec,
      amountG: String(d.amountG),
      unitPrice: ing.unitPrice ?? 0,
      unit: ing.unit || "g",
      cost: d.cost != null ? Number(d.cost) : calcCost(ing.unitPrice ?? 0, d.amountG),
    });
  });

  dish.sauceDetails?.forEach((d) => {
    const ing = findSauce(d.sauceId);
    if (!ing) return;
    bom.sauce.push({
      id: `sauce-${d.sauceId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.sauceId,
      name: ing.name,
      productName: d.brand || ing.productName,
      spec: ing.spec,
      amountG: String(d.amountG),
      unitPrice: ing.unitPrice ?? 0,
      unit: ing.unit || "g",
      cost: d.cost != null ? Number(d.cost) : calcCost(ing.unitPrice ?? 0, d.amountG),
    });
  });

  return bom;
}

export function dishToProcesses(dish: DishDetail): ProcessStep[] {
  return (dish.processes || []).map((p) => ({ ...p }));
}

export function bomToPayload(bom: Record<BomType, BomItem[]>) {
  return {
    netDetails: [
      ...bom.main.map((item) => ({
        role: "main" as const,
        netIngId: item.sourceId,
        amountG: Number(item.amountG),
        spec: null as string | null,
      })),
      ...bom.support.map((item) => ({
        role: "support" as const,
        netIngId: item.sourceId,
        amountG: Number(item.amountG),
        spec: null as string | null,
      })),
    ],
    minorDetails: bom.minor.map((item) => ({
      netIngId: item.sourceId,
      amountG: Number(item.amountG),
      brand: item.productName || null,
    })),
    seasoningDetails: bom.seasoning.map((item) => ({
      sourceId: item.sourceId,
      amountG: Number(item.amountG),
      brand: item.productName || null,
    })),
    sauceDetails: bom.sauce.map((item) => ({
      sauceId: item.sourceId,
      amountG: Number(item.amountG),
      brand: item.productName || null,
    })),
  };
}

export function validatePublish(form: DishFormData, bom: Record<BomType, BomItem[]>, processes: ProcessStep[]): string | null {
  if (!form.name.trim()) return "菜品名称不能为空";
  if (!form.categoryId) return "请选择菜品类别";
  if (!form.cuisine) return "请选择菜系";
  if (!form.technique) return "请选择做法";
  if (!form.taste) return "请选择口味";
  if (!form.meatType) return "请选择荤素类型";
  if (bom.main.length === 0) return "主料不能为空";
  if (bom.support.length === 0) return "辅料不能为空";
  if (bom.minor.length === 0) return "小料不能为空";
  if (bom.seasoning.length === 0) return "调料不能为空";
  if (processes.length === 0) return "加工工艺不能为空";
  const stages = new Set(processes.map((p) => p.stage));
  for (const s of VALID_STAGES) {
    if (!stages.has(s)) return `${s}阶段不能为空`;
  }
  return null;
}

export function formatCost(value: number | null | undefined): string {
  if (value == null) return "—";
  return `¥${Number(value).toFixed(2)}`;
}

export function calcCost(unitPrice: number, amountG: string | number): number | null {
  const amount = typeof amountG === "string" ? parseFloat(amountG) : amountG;
  if (Number.isNaN(amount) || amount <= 0) return null;
  return Number((unitPrice * amount / 1000).toFixed(4));
}

export function totalBomCost(bom: Record<BomType, BomItem[]>): number {
  let total = 0;
  (Object.keys(bom) as BomType[]).forEach((type) => {
    bom[type].forEach((item) => {
      if (item.cost != null) total += item.cost;
    });
  });
  return Number(total.toFixed(4));
}
