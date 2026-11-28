import { z } from "zod";

// 净料统一口径（2026-11-28 起小料并入净料）：均由原料转化而来（来源原料 + 出成率 + 包装规格），价格体系元/斤
export const createNetIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  // 来源原料：必填
  sourceIngredientId: z.number().int().positive(),
  // 净料包装规格（g），必填：标准规格价格的计算基础
  packageSpec: z.number().int().min(1).max(1000000),
  // 包装物料，如 密封袋
  packageMaterial: z.string().trim().max(100).nullish(),
  // 包装尺寸，如 35cm×30cm
  packageSize: z.string().trim().max(100).nullish(),
  // 封装加工费（元/斤），空 = 0
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  // 毛利率（%）：空 = 0；真毛利率口径，出库价 = 成本价 ÷ (1 - 毛利率/100)，上限 95
  grossMarginRate: z.number().min(0).max(95).nullish(),
  // 出成率（%）：必填。可超过 100——上浆/挂糊类食材出成率会大于 100（如 120 = 出 1.2 斤成品）
  yieldRate: z.number().min(0.01).max(500),
  // 份量标签：与菜品共用份量档案（portion_profiles）；形态校验在 zod，合法性由路由层查表
  portion: z.string().trim().min(1).max(50),
  // 兼容旧客户端，服务端会忽略并始终按来源原料实时价格派生
  unitPrice: z.number().nonnegative().nullish(),
  l2Code: z.string().min(1).max(20),
  // 三级分类（可选，不做强限制；须为 l2Code 的子级）
  l3Code: z.string().min(1).max(20).nullish(),
  /** 兼容旧客户端；净料单价现已强制自动计算 */
  autoCalculate: z.boolean().default(true),
});

export const updateNetIngredientSchema = createNetIngredientSchema
  .partial()
  .extend({
    // 显式传 null 表示清空份量；不传表示保持原值
    portion: z.string().trim().min(1).max(50).nullish(),
  });

export const netIngredientQuerySchema = z.object({
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  l3Code: z.string().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});