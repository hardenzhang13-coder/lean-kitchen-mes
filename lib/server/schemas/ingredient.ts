import { z } from "zod";
import { SEASONING_TYPES } from "@/lib/shared/seasoning-type";

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  alias: z.string().max(100).optional(),
  l2Code: z.string().min(1).max(20),
  // 调味品类型：仅 SEA 体系调味品可携带；空字符串 = 清空（同 alias 口径）
  seasoningType: z.enum(SEASONING_TYPES).or(z.literal("")).optional(),
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
  // 模块边界：raw = 仅原料（排除调味品体系）；seasoning = 仅调料；缺省返回全部（采购识别等跨体系场景）
  kind: z.enum(["raw", "seasoning"]).optional(),
  // 调味品类型过滤：单品调料/复合调料/成品酱料（与 kind=seasoning 组合使用）
  seasoningType: z.enum(SEASONING_TYPES).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
