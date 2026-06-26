import { z } from "zod";

export const dishStatusSchema = z.enum(["draft", "published"]);

export const createDishSchema = z.object({
  name: z.string().min(1).max(100),
  intro: z.string().max(500).optional(),
  categoryId: z.number().int().positive(),
  cuisine: z.string().max(50).optional(),
  technique: z.string().max(50).optional(),
  taste: z.string().max(50).optional(),
  portion: z.string().max(50).default("正餐份量"),
  season: z.string().max(50).default("四季"),
  meatType: z.string().max(50).optional(),
  status: dishStatusSchema.default("draft"),
});

export const updateDishSchema = createDishSchema.partial().omit({ categoryId: true });

export const dishQuerySchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  cuisine: z.string().optional(),
  meatType: z.string().optional(),
  status: dishStatusSchema.optional(),
  q: z.string().max(100).optional(),
});
