import { z } from "zod";
import { SEASONING_PRODUCT_TYPES } from "@/lib/shared/seasoning-product";

// Zod 4 的 .partial() 会保留 .default()：带默认值的字段不能作为 update 基座，
// 否则部分更新缺省时会被默认值覆盖（如 kind 缺省被填成 food，调味品被误判为食材）。
// 默认值只放 create 侧，update 侧显式 optional。
const ingredientFields = {
  name: z.string().min(1).max(100),
  alias: z.string().max(100).optional(),
  // 调味品类型（仅 kind=seasoning）：单品调料/复合调料/成品酱料；转化产物按此类型归档
  seasoningType: z.enum(SEASONING_PRODUCT_TYPES).nullish(),
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
};

const kindField = z.enum(["food", "seasoning"]);
const seasonField = z.string().max(50);
const storageField = z.string().max(50);

export const createIngredientSchema = z.object({
  ...ingredientFields,
  // 大类边界：food=食材（l2Code 必填，路由层校验）/ seasoning=调味品（独立体系，不挂分类）
  kind: kindField.default("food"),
  season: seasonField.default("四季"),
  storage: storageField.default("常温"),
});

export const updateIngredientSchema = z
  .object(ingredientFields)
  .partial()
  .extend({
    kind: kindField.optional(),
    season: seasonField.optional(),
    storage: storageField.optional(),
  });

export const ingredientQuerySchema = z.object({
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  // 模块边界：raw = 仅食材（排除调味品）；seasoning = 仅调味品；缺省返回全部（采购识别等跨体系场景）
  kind: z.enum(["raw", "seasoning"]).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
