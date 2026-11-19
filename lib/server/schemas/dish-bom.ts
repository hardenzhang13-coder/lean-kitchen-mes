import { z } from "zod";

// 净料/小料的 amountG 由服务端按档案 packageSpec 覆盖，客户端传值不参与计算
export const dishBomNetDetailSchema = z.object({
  role: z.string().max(50).optional(),
  netIngId: z.number().int().positive(),
  amountG: z.number().positive().optional(),
  spec: z.string().max(200).nullish(),
  brand: z.string().max(100).nullish(),
});

export const dishBomMinorDetailSchema = z.object({
  netIngId: z.number().int().positive(),
  amountG: z.number().positive().optional(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSeasoningSchema = z.object({
  // 标准化规格（standard_seasonings.id）：新口径，用量由服务端按标准规格强制覆盖
  specId: z.number().int().positive().nullish(),
  // 旧口径来源调料（ingredients.id）：specId 为空时必填（存量行）
  sourceId: z.number().int().positive().optional(),
  amountG: z.number().positive().optional(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSauceSchema = z.object({
  sauceId: z.number().int().positive(),
  amountG: z.number().positive(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSchema = z.object({
  netDetails: z.array(dishBomNetDetailSchema).optional(),
  minorDetails: z.array(dishBomMinorDetailSchema).optional(),
  seasoningDetails: z.array(dishBomSeasoningSchema).optional(),
  sauceDetails: z.array(dishBomSauceSchema).optional(),
});
