import { z } from "zod";

// 净料/小料统一口径：均由原料转化而来（来源原料 + 出成率 + 封装规格），价格体系元/斤
export const createNetIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  // 来源原料：净料/小料必填
  sourceIngredientId: z.number().int().positive(),
  // 净料/小料封装规格（g），必填：标准规格价格的计算基础
  packageSpec: z.number().int().min(1).max(1000000),
  // 封装加工费（元/斤），空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 出成率（%）：必填。可超过 100——上浆/挂糊类食材出成率会大于 100（如 120 = 出 1.2 斤成品）
  yieldRate: z.number().min(0.01).max(500),
  // 净料单价（元/斤）：缺省时服务端按 原料每斤单价 ÷ 出成率 自动计算
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
