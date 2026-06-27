import { z } from "zod";

export const SAUCE_TYPES = ["自制", "外购"] as const;

export const createSauceIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  brand: z.string().max(100).default(""),
  spec: z.string().max(200).nullish(),
  recipe: z.string().max(500).nullish(),
  type: z.enum(SAUCE_TYPES),
  unitPrice: z.number().nonnegative().default(0),
});

export const updateSauceIngredientSchema = createSauceIngredientSchema.partial();

export const sauceIngredientQuerySchema = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
