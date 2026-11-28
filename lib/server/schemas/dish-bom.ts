import { z } from "zod";
import { DISH_NET_ROLE_VALUES } from "@/lib/shared/dish-enums";

// 净料/小料的 amountG 由服务端按档案 packageSpec 覆盖，客户端传值不参与计算
export const dishBomNetDetailSchema = z.object({
  // 主料/辅料；小料行走 minorDetails（服务端落 role='minor'）
  role: z.enum([DISH_NET_ROLE_VALUES[0], DISH_NET_ROLE_VALUES[1]]).optional(),
  netIngId: z.number().int().positive(),
  amountG: z.number().positive().optional(),
  spec: z.string().max(200).nullish(),
  brand: z.string().max(100).nullish(),
});

// 小料行：物理落 dish_net_details（role='minor'），契约保留独立字段名
export const dishBomMinorDetailSchema = z.object({
  netIngId: z.number().int().positive(),
  amountG: z.number().positive().optional(),
  brand: z.string().max(100).nullish(),
});

export const dishBomSeasoningSchema = z.object({
  // 新口径：调料产物（SeasoningProduct.id），菜品 BOM 一律选产物按克计
  specId: z.number().int().positive().nullish(),
  // 旧口径兼容字段：直引调味品原料（仅存量客户端回传，新行不传）
  sourceId: z.number().int().positive().nullish(),
  // 克需求（g）：按克直接计成本，服务端不覆盖客户端取值
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
