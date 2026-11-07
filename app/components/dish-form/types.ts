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
  /** 成本价（元/斤）：净料/小料 = 净料单价+封装加工费；调料 = 每斤单价 */
  costPrice?: number | null;
  cost?: number | null;
  l1Code?: string;
  l2Code?: string;
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
  price: string;
}

export interface IngredientOption {
  id: number;
  code: string;
  name: string;
  productName?: string | null;
  /** 规格：净料/小料 = 封装规格（如 500g）；调料 = 采购规格；酱料 = 规格 */
  spec?: string | null;
  unitPrice: number | null;
  /** 成本价（元/斤）：净料/小料 = 净料单价+封装加工费；调料 = 每斤单价 */
  costPrice?: number | null;
  /** 净料/小料封装规格（g） */
  packageSpec?: number | null;
  /** 价格口径单位：净料/小料/调料为「斤」 */
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
  ingredientCategories: IngredientCategory[];
}

export const BOM_TYPE_LABELS: Record<BomType, string> = {
  main: "主料",
  support: "辅料",
  minor: "小料",
  seasoning: "调料",
  sauce: "酱料",
};

// 发布必填规则以 validatePublish 为准：主料/辅料必填；小料/调料/酱料可选（先跑业务，后续再收紧）

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

export const STAGE_COLORS: Record<
  ProcessStage,
  { dot: string; badge: string; step: string }
> = {
  "初加工": {
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700",
    step: "from-indigo-500 to-cyan-400",
  },
  "预处理": {
    dot: "bg-orange-500",
    badge: "bg-orange-50 text-orange-700",
    step: "from-orange-500 to-amber-400",
  },
  "上灶加工": {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700",
    step: "from-red-500 to-rose-400",
  },
  "出锅成品": {
    dot: "bg-green-500",
    badge: "bg-green-50 text-green-700",
    step: "from-green-500 to-emerald-400",
  },
};

export interface DishDetail {
  id: number;
  code: string;
  name: string;
  intro: string | null;
  categoryId?: number;
  category?: { id: number; code: string; name: string } | null;
  cuisine?: string | null;
  technique?: string | null;
  taste?: string | null;
  portion?: string | null;
  season?: string | null;
  meatType?: string | null;
  cost?: number | null;
  price?: number | null;
  status: string;
  createdAt?: string | Date;
  netDetails?: Array<{
    role?: string;
    netIngId: number;
    amountG: number | string;
    spec?: string | null;
    cost?: number | null;
    netIngredient?: { id: number; code: string; name: string; unitPrice: number | null; outPricePerJin?: number | null; unit: string | null; packageSpec?: number | null } | null;
  }>;
  minorDetails?: Array<{
    netIngId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    name?: string;
    unitPrice?: number | null;
    unit?: string | null;
    netIngredient?: { id: number; code: string; name: string; unitPrice: number | null; outPricePerJin?: number | null; unit: string | null; packageSpec?: number | null } | null;
  }>;
  seasoningDetails?: Array<{
    sourceId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    name?: string;
    unitPrice?: number | null;
    /** 每斤单价（元/斤）：调料 BOM 成本口径 */
    pricePerJin?: number | null;
    unit?: string | null;
    /** 采购规格（与食材模块调料表一致，如 1.9L*6） */
    spec?: string | null;
  }>;
  sauceDetails?: Array<{
    sauceId: number;
    amountG: number | string;
    brand?: string | null;
    cost?: number | null;
    sauce?: {
      id: number;
      code: string;
      name: string;
      type: string;
      costPricePerJin?: number | null;
      /** 出库价（元/斤）：酱料 BOM 成本口径 */
      outPricePerJin?: number | null;
    } | null;
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
    portion: dish.portion || "单人份",
    season: dish.season || "四季",
    meatType: dish.meatType || "",
    price: dish.price != null ? String(dish.price) : "",
  };
}

/** 净料系（主料/辅料/小料）规格展示：优先封装规格 packageSpec（与食材模块一致），缺失回退历史自由文本 */
export function netSpecText(
  ing: { packageSpec?: number | null } | null | undefined,
  legacySpec?: string | null
): string | null {
  const pkg = ing?.packageSpec;
  if (pkg != null) return `${pkg}g`;
  return legacySpec ?? null;
}

export function emptyBom(): Record<BomType, BomItem[]> {
  return { main: [], support: [], minor: [], seasoning: [], sauce: [] };
}

export function dishToBom(dish: DishDetail): Record<BomType, BomItem[]> {
  const bom = emptyBom();

  dish.netDetails?.forEach((d) => {
    const ing = d.netIngredient;
    const name = ing?.name ?? "";
    const unitPrice = ing?.unitPrice ?? 0;
    const unit = ing?.unit ?? "g";
    // 出库价（元/斤，含加工费与毛利）为 BOM 成本口径
    const costPrice = ing?.outPricePerJin ?? null;
    const type: BomType = d.role === "support" ? "support" : "main";
    const item: BomItem = {
      id: `net-${d.netIngId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.netIngId,
      name,
      spec: netSpecText(ing, d.spec),
      amountG: String(d.amountG),
      unitPrice,
      unit,
      costPrice,
      cost: d.cost != null ? Number(d.cost) : calcCost(type, costPrice, d.amountG),
    };
    if (d.role === "support") bom.support.push(item);
    else bom.main.push(item);
  });

  dish.minorDetails?.forEach((d) => {
    const ing = d.netIngredient;
    const name = ing?.name ?? d.name ?? "";
    const unitPrice = ing?.unitPrice ?? d.unitPrice ?? 0;
    const unit = ing?.unit ?? d.unit ?? "g";
    const costPrice = ing?.outPricePerJin ?? null;
    bom.minor.push({
      id: `minor-${d.netIngId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.netIngId,
      name,
      productName: d.brand,
      spec: netSpecText(ing, null),
      amountG: String(d.amountG),
      unitPrice,
      unit,
      costPrice,
      cost: d.cost != null ? Number(d.cost) : calcCost("minor", costPrice, d.amountG),
    });
  });

  dish.seasoningDetails?.forEach((d) => {
    const name = d.name ?? "";
    const unitPrice = d.unitPrice ?? 0;
    const unit = d.unit ?? "g";
    // 调料成本价 = 每斤单价（元/斤）
    const costPrice = d.pricePerJin ?? null;
    bom.seasoning.push({
      id: `sea-${d.sourceId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.sourceId,
      name,
      productName: d.brand,
      spec: d.spec ?? null,
      amountG: String(d.amountG),
      unitPrice,
      unit,
      costPrice,
      cost: d.cost != null ? Number(d.cost) : calcCost("seasoning", costPrice, d.amountG),
    });
  });

  dish.sauceDetails?.forEach((d) => {
    const ing = d.sauce;
    const name = ing?.name ?? "";
    // 出库价（元/斤，含成本价与毛利）为 BOM 成本口径
    const costPrice = ing?.outPricePerJin ?? null;
    bom.sauce.push({
      id: `sauce-${d.sauceId}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: d.sauceId,
      name,
      productName: d.brand,
      amountG: String(d.amountG),
      unitPrice: 0,
      unit: "斤",
      costPrice,
      cost: d.cost != null ? Number(d.cost) : calcCost("sauce", costPrice, d.amountG),
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
        spec: item.spec || null,
      })),
      ...bom.support.map((item) => ({
        role: "support" as const,
        netIngId: item.sourceId,
        amountG: Number(item.amountG),
        spec: item.spec || null,
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

export function validatePublish(form: DishFormData, bom: Record<BomType, BomItem[]>): string | null {
  if (!form.name.trim()) return "菜品名称不能为空";
  if (!form.categoryId) return "请选择菜品类别";
  if (!form.cuisine) return "请选择菜系";
  if (!form.technique) return "请选择做法";
  if (!form.taste) return "请选择口味";
  if (!form.meatType) return "请选择荤素类型";
  if (bom.main.length === 0) return "主料不能为空";
  if (bom.support.length === 0) return "辅料不能为空";
  return null;
}

export function validateDishDetailForPublish(dish: DishDetail): string | null {
  if (!dish.name?.trim()) return "菜品名称不能为空";
  if (!dish.categoryId) return "请选择菜品类别";
  if (!dish.cuisine) return "请选择菜系";
  if (!dish.technique) return "请选择做法";
  if (!dish.taste) return "请选择口味";
  if (!dish.meatType) return "请选择荤素类型";
  if (!dish.netDetails?.some((d) => d.role === "main")) return "主料不能为空";
  if (!dish.netDetails?.some((d) => d.role === "support")) return "辅料不能为空";
  return null;
}

export function formatCost(value: number | null | undefined): string {
  if (value == null) return "—";
  return `¥${Number(value).toFixed(2)}`;
}

/** 菜品毛利率（%）= (售价 - 成本) ÷ 售价 × 100；售价缺失或不为正数时返回 null */
export function calcGrossMarginPercent(
  cost: number | null | undefined,
  price: number | null | undefined
): number | null {
  const c = cost != null ? Number(cost) : null;
  const pr = price != null ? Number(price) : null;
  if (c == null || pr == null || pr <= 0) return null;
  return Number((((pr - c) / pr) * 100).toFixed(1));
}

/** 由成本与毛利率反推售价：售价 = 成本 ÷ (1 - 毛利率/100)，毛利率需小于 100 */
export function calcPriceByMargin(cost: number, marginPercent: number): number | null {
  if (cost < 0 || marginPercent < 0 || marginPercent >= 100) return null;
  const rate = 1 - marginPercent / 100;
  if (rate <= 0) return null;
  return Number((cost / rate).toFixed(2));
}

export function calcCost(
  type: BomType,
  pricePerJin: number | null | undefined,
  amountG: string | number
): number | null {
  const amount = typeof amountG === "string" ? parseFloat(amountG) : amountG;
  if (Number.isNaN(amount) || amount <= 0) return null;
  if (pricePerJin == null) return null;
  // 全部元/斤口径（1 斤 = 500g）：净料/小料 = 出库价、调料 = 每斤单价、酱料 = 出库价
  const gramsPerPriceUnit = 500;
  return Number(((pricePerJin * amount) / gramsPerPriceUnit).toFixed(4));
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

export function normalizeNetIngredients(items: unknown[]): IngredientOption[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const sourceIngredient = record.sourceIngredient as Record<string, unknown> | undefined;
      const id = Number(record.id);
      if (Number.isNaN(id)) return null;
      const packageSpec = record.packageSpec != null ? Number(record.packageSpec) : null;
      const outPrice = record.outPricePerJin != null ? Number(record.outPricePerJin) : null;
      return {
        id,
        code: String(record.code || ""),
        name: String(record.name || ""),
        productName: String(sourceIngredient?.name || ""),
        // 规格展示用封装规格（原自由文本 spec 字段已废弃）
        spec: packageSpec != null ? `${packageSpec}g` : "",
        unitPrice: record.unitPrice != null ? Number(record.unitPrice) : null,
        // 出库价（元/斤，含加工费与毛利），BOM 成本口径
        costPrice: outPrice,
        packageSpec,
        // 价格口径单位（BOM 用量仍按 g 录入）
        unit: "斤",
        l2Code: String(record.l2Code || ""),
      } as IngredientOption;
    })
    .filter((item): item is IngredientOption => item != null);
}

export function normalizeIngredients(items: unknown[]): IngredientOption[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      if (Number.isNaN(id)) return null;
      return {
        id,
        code: String(record.code || ""),
        name: String(record.name || ""),
        productName: String(record.alias || ""),
        spec: String(record.purchaseSpec || ""),
        unitPrice: record.latestRefPrice != null ? Number(record.latestRefPrice) : null,
        // 调料成本价 = 每斤单价（元/斤）
        costPrice: record.pricePerJin != null ? Number(record.pricePerJin) : null,
        unit: "斤",
        l2Code: String(record.l2Code || ""),
      } as IngredientOption;
    })
    .filter((item): item is IngredientOption => item != null);
}

export function normalizeSauces(items: unknown[]): IngredientOption[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item == null || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = Number(record.id);
      if (Number.isNaN(id)) return null;
      return {
        id,
        code: String(record.code || ""),
        name: String(record.name || ""),
        productName: String(record.brand || ""),
        spec: String(record.purchaseSpec || ""),
        // 零售参考价（元/采购单位），仅作展示
        unitPrice: record.latestRefPrice != null ? Number(record.latestRefPrice) : null,
        // 成本价口径 = 出库价（元/斤，含毛利）
        costPrice: record.outPricePerJin != null ? Number(record.outPricePerJin) : null,
        unit: "斤",
      } as IngredientOption;
    })
    .filter((item): item is IngredientOption => item != null);
}
