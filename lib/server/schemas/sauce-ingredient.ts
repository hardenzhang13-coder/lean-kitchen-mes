import { z } from "zod";

export const SAUCE_TYPES = ["自制", "外购"] as const;

export const recipeLineSchema = z.object({
  // net（净料/小料，引用 net_ingredients）/ seasoning（调料，引用 ingredients 中 SEA 子树）
  lineType: z.enum(["net", "seasoning"]),
  refId: z.number().int().positive(),
  amountG: z.number().positive().max(1000000),
});

// 酱料统一口径：成本价 + 毛利率 → 出库价（元/斤）。
// 自制：recipeLines 为成本来源（至少 1 行）；外购：采购规格自动换算每斤单价。
export const createSauceIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(SAUCE_TYPES),
  // 外购字段（同调料录入逻辑）
  brand: z.string().max(100).nullish(),
  purchaseSpec: z.string().max(200).nullish(),
  purchaseUnit: z.string().max(20).nullish(),
  latestRefPrice: z.number().nonnegative().max(1000000).nullish(),
  pricePerJin: z.number().nonnegative().max(1000000).nullish(),
  grossMarginRate: z.number().min(0).max(95).nullish(),
  // 加工费（元/斤）：自制酱料加工环节每斤成本，计入成本价；空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 封装规格（g）：标准规格价 = 出库价 × 封装规格 ÷ 500；空 = 不启用
  packageSpec: z.number().int().min(1).max(1000000).nullish(),
  storage: z.string().max(10).nullish(),
  // 默认供应商：采购计划按供应商拆单用，可空
  defaultSupplierId: z.number().int().positive().nullish(),
  // 备注（延伸用途）
  remark: z.string().max(500).nullish(),
  recipeLines: z.array(recipeLineSchema).max(200).optional(),
});

export const updateSauceIngredientSchema = createSauceIngredientSchema.partial();

export const sauceIngredientQuerySchema = z.object({
  q: z.string().max(100).optional(),
  type: z.enum(SAUCE_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
