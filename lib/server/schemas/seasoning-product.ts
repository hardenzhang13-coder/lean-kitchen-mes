import { z } from "zod";
import {
  SEASONING_PRODUCT_TYPES,
  SEASONING_SOURCE_MODES,
} from "@/lib/shared/seasoning-product";

// 调料产物：单品调料 / 复合调料 / 成品酱料同构。
// - transform（转化）：来源调味品（kind=seasoning）× 出成率派生单价，与净料转化同构
// - purchase（外购）：品牌/采购规格建档，手填每斤单价直接落价
// 价格链路由服务端实时派生（单价/成本价/出库价/标准规格价），客户端传入的单价被忽略；
// 份量共用 portion_profiles 档案（形态校验在 zod，合法性由路由层查表）。
export const createSeasoningProductSchema = z.object({
  name: z.string().min(1).max(100),
  productType: z.enum(SEASONING_PRODUCT_TYPES),
  sourceMode: z.enum(SEASONING_SOURCE_MODES),
  // 转化口径：来源调味品 + 出成率（路由层条件必填并校验 kind=seasoning）
  sourceIngredientId: z.number().int().positive().nullish(),
  yieldRate: z.number().min(0.01).max(500).nullish(),
  // 外购口径：品牌/采购规格/采购单位/参考价/手填每斤单价
  brand: z.string().max(100).nullish(),
  purchaseSpec: z.string().max(200).nullish(),
  purchaseUnit: z.string().max(20).nullish(),
  latestRefPrice: z.number().nonnegative().nullish(),
  pricePerJin: z.number().positive().nullish(),
  defaultSupplierId: z.number().int().positive().nullish(),
  // 封装规格（g），必填：标准规格价的计算基础
  packageSpec: z.number().int().min(1).max(1000000),
  // 份量标签：与净料、菜品共用份量档案（portion_profiles）
  portion: z.string().trim().min(1).max(50),
  // 封装加工费（元/斤），空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 毛利率（%）：空 = 0；出库价 = 成本价 ÷ (1 - 毛利率/100)，上限 95
  grossMarginRate: z.number().min(0).max(95).nullish(),
  storage: z.string().trim().max(20).nullish(),
});

export const updateSeasoningProductSchema = createSeasoningProductSchema
  .partial()
  .extend({
    // 显式传 null 表示清空份量；不传表示保持原值
    portion: z.string().trim().min(1).max(50).nullish(),
  });

export const seasoningProductQuerySchema = z.object({
  productType: z.enum(SEASONING_PRODUCT_TYPES).optional(),
  sourceMode: z.enum(SEASONING_SOURCE_MODES).optional(),
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
