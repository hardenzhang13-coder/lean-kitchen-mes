import { z } from "zod";

export const createNetIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  sourceIngredientId: z.number().int().positive().nullish(),
  // 自由文本规格：仅小料使用；净料改用 packageSpec
  spec: z.string().max(200).nullish(),
  // 净料封装规格（g），净料必填（服务端按 l2Code 归属判定，见路由）
  packageSpec: z.number().int().min(1).max(1000000).nullish(),
  // 封装加工费（元/斤），空 = 0；仅净料使用
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  yieldRate: z.number().min(1).max(100).nullish(),
  // 成本价：净料 = 元/斤；小料 = 元/10g
  unitPrice: z.number().nonnegative().nullish(),
  l2Code: z.string().min(1).max(20),
  autoCalculate: z.boolean().default(true),
});

export const updateNetIngredientSchema = createNetIngredientSchema.partial();

export const netIngredientQuerySchema = z.object({
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  excludeMinor: z.coerce.boolean().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
