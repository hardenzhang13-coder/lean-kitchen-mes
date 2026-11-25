import { z } from "zod";

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  alias: z.string().max(100).optional(),
  // 大类边界：food=食材（l2Code 必填，路由层校验）/ seasoning=调味品（独立体系，不挂分类）
  kind: z.enum(["food", "seasoning"]).default("food"),
  l2Code: z.string().min(1).max(20).optional(),
  purchaseUnit: z.string().min(1).max(20).optional(),
  stockUnit: z.string().min(1).max(20).optional(),
  // 入库数量：每 1 个采购单位对应的入库单位数（散称 = 1）
  unitsPerPurchase: z.number().int().min(1).max(100000).optional(),
  purchaseSpec: z.string().max(200).optional(),
  latestRefPrice: z.number().nonnegative().optional(),
  pricePerJin: z.number().nonnegative().optional(),
  // 默认供应商：采购计划按供应商拆单用，可空
  defaultSupplierId: z.number().int().positive().nullish(),
  season: z.string().max(50).default("四季"),
  storage: z.string().max(50).default("常温"),
});

export const updateIngredientSchema = createIngredientSchema.partial();

export const ingredientQuerySchema = z.object({
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  // 模块边界：raw = 仅食材（排除调味品）；seasoning = 仅调味品；缺省返回全部（采购识别等跨体系场景）
  kind: z.enum(["raw", "seasoning"]).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
