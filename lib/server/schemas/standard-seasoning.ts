import { z } from "zod";

// 标准化调料：由「调料采购档案」转化而来，是菜品 BOM 里调料的唯一引用对象。
// 口径与净料同构：标准规格以 g 计，份量共用同一套枚举，价格链路由服务端按来源调料现价派生。
// 二级分类不在此声明：始终继承来源调料，服务端强制，杜绝分类漂移。
export const createStandardSeasoningSchema = z.object({
  name: z.string().min(1).max(100),
  // 来源调料：标准化规格的来源档案，必填（服务端校验须属 SEA 调味品体系）
  sourceIngredientId: z.number().int().positive(),
  // 标准规格（g），必填：标准规格价与 BOM 用量的计算基础
  packageSpec: z.number().int().min(1).max(1000000),
  // 份量标签：与净料、菜品共用份量档案（portion_profiles）；形态校验在 zod，合法性由路由层查表
  portion: z.string().trim().min(1).max(50),
  // 出成率（%）：必填，可超过 100（分装吸水类）
  yieldRate: z.number().min(0.01).max(500),
  // 封装加工费（元/斤），空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 毛利率（%）：空 = 0；出库价 = 成本价 ÷ (1 - 毛利率/100)，上限 95
  grossMarginRate: z.number().min(0).max(95).nullish(),
  storage: z.string().trim().max(20).nullish(),
});

export const updateStandardSeasoningSchema = createStandardSeasoningSchema
  .partial()
  .extend({
    // 显式传 null 表示清空份量；不传表示保持原值
    portion: z.string().trim().min(1).max(50).nullish(),
  });

export const standardSeasoningQuerySchema = z.object({
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
