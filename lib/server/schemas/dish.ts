import { z } from "zod";

import {
  DISH_STATUS_ACTIONS,
  DISH_STATUS_VALUES,
} from "@/lib/shared/dish-status";
import { PORTION_VALUES } from "@/lib/shared/portion-scale";

export const dishStatusSchema = z.enum(DISH_STATUS_VALUES);

export const createDishSchema = z.object({
  name: z.string().min(1).max(100),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).default("小碗菜"),
  season: z.string().max(50).default("四季"),
  meatType: z.string().max(50).optional(),
  price: z.number().nonnegative().optional(),
});

export const updateDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive().optional(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).optional(),
  season: z.string().max(50).optional(),
  meatType: z.string().max(50).optional(),
  price: z.number().nonnegative().optional(),
});

export const dishQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  cuisine: z.string().optional(),
  technique: z.string().optional(),
  meatType: z.string().optional(),
  portion: z.string().optional(),
  status: dishStatusSchema.optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/** 菜品状态流转动作 */
export const dishStatusActionSchema = z.object({
  action: z.enum(DISH_STATUS_ACTIONS),
});

/** 菜品规格派生：由源菜品按倍率生成新份量规格档案 */
export const scaleDishSchema = z.object({
  portion: z.enum(PORTION_VALUES),
  name: z.string().min(1).max(100).optional(),
});

/** 菜品复制：以现有档案为模板新建一条草稿，名称可覆盖 */
export const copyDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
