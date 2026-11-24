import { z } from "zod";

import {
  DISH_STATUS_ACTIONS,
  DISH_STATUS_VALUES,
} from "@/lib/shared/dish-status";

export const dishStatusSchema = z.enum(DISH_STATUS_VALUES);

export const createDishSchema = z.object({
  name: z.string().min(1).max(100),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive().nullish(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  // 份量标签：形态校验在 zod，合法性（命中份量档案）由路由层查表校验
  portion: z.string().trim().min(1).max(50).default("单人份"),
  season: z.string().max(50).default("四季"),
  meatType: z.string().max(50).optional(),
  price: z.number().nonnegative().nullish(),
});

export const updateDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive().nullish(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).optional(),
  season: z.string().max(50).optional(),
  meatType: z.string().max(50).optional(),
  price: z.number().nonnegative().nullish(),
});

export const dishQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  cuisine: z.string().optional(),
  technique: z.string().optional(),
  meatType: z.string().optional(),
  portion: z.string().optional(),
  // 份量分组 = 份量档案（portion_profiles）的 scenario，自由字符串
  portionGroup: z.string().trim().max(50).optional(),
  status: dishStatusSchema.optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/** 菜品状态流转动作 */
export const dishStatusActionSchema = z.object({
  action: z.enum(DISH_STATUS_ACTIONS),
});

/** 菜品转换时缺失的净料/小料规格（用户确认后自动建档） */
export const scaleSpecSchema = z.object({
  kind: z.enum(["net", "minor"]),
  sourceNetIngId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  packageSpec: z.number().int().min(1).max(1000000),
  yieldRate: z.number().min(0.01).max(500),
  processingFeePerJin: z.number().min(0).max(10000).nullish(),
  grossMarginRate: z.number().min(0).max(95).nullish(),
});

/** 菜品规格派生：由源菜品按倍率生成新份量规格档案 */
export const scaleDishSchema = z.object({
  // 目标份量标签：须命中启用中的份量档案且与源不同（路由层查表校验）
  portion: z.string().trim().min(1).max(50),
  name: z.string().min(1).max(100).optional(),
  specs: z.array(scaleSpecSchema).max(200).optional(),
});

/** 转化预览：只选择目标份量，返回净料/小料规格匹配计划 */
export const scalePreviewSchema = z.object({
  portion: z.string().trim().min(1).max(50),
});

/** 菜品复制：以现有档案为模板新建一条草稿，名称可覆盖 */
export const copyDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
