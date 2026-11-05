import { z } from "zod";

export const dishStatusSchema = z.enum(["draft", "published"]);

export const createDishSchema = z.object({
  name: z.string().min(1).max(100),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).default("单人份"),
  season: z.string().max(50).default("四季"),
  meatType: z.string().max(50).optional(),
  cost: z.number().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  status: dishStatusSchema.default("draft"),
});

export const updateDishSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  intro: z.string().max(500).optional(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).optional(),
  season: z.string().max(50).optional(),
  meatType: z.string().max(50).optional(),
  cost: z.number().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  status: dishStatusSchema.optional(),
});

export const dishQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  cuisine: z.string().optional(),
  meatType: z.string().optional(),
  status: dishStatusSchema.optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/** 菜品规格派生：由源菜品按倍率生成新份量规格档案 */
export const scaleDishSchema = z.object({
  portion: z.string().min(1).max(50),
});
