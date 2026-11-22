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
  // 来源调料（ingredients.id，SEA 调味品体系）：调料直接引用采购档案
  sourceId: z.number().int().positive(),
  // 克需求（g）：调料按克直接计成本，服务端不覆盖客户端取值
  amountG: z.number().positive(),
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
