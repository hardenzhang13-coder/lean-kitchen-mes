import { z } from "zod";
import { SEASONING_PRODUCT_TYPES } from "@/lib/shared/seasoning-product";

// 调料产物：单品调料 / 复合调料 / 成品酱料同构，只能由调味品「转化」生成。
// - 来源调味品（kind=seasoning）× 出成率派生单价，与净料转化同构
// - 产物类型不在此传入：服务端继承来源调味品的 seasoningType
// 价格链路由服务端实时派生（单价/成本价/出库价/标准规格价），客户端传入的单价被忽略。
export const createSeasoningProductSchema = z.object({
  name: z.string().min(1).max(100),
  sourceIngredientId: z.number().int().positive(),
  yieldRate: z.number().min(0.01).max(500),
  // 封装规格（g），必填：标准规格价的计算基础
  packageSpec: z.number().int().min(1).max(1000000),
  // 封装加工费（元/斤），空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 毛利率（%）：空 = 0；出库价 = 成本价 ÷ (1 - 毛利率/100)，上限 95
  grossMarginRate: z.number().min(0).max(95).nullish(),
  storage: z.string().trim().max(20).nullish(),
});

export const updateSeasoningProductSchema = createSeasoningProductSchema.partial();

export const seasoningProductQuerySchema = z.object({
  productType: z.enum(SEASONING_PRODUCT_TYPES).optional(),
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
