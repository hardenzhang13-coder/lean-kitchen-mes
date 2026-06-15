import { z } from "zod";

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  alias: z.string().max(100).optional(),
  l2Code: z.string().min(1).max(20),
  unit: z.string().min(1).max(20),
  priceUnit: z.string().min(1).max(20).optional(),
  purchaseUnit: z.string().min(1).max(20).optional(),
  stockUnit: z.string().min(1).max(20).optional(),
  purchaseSpec: z.string().max(200).optional(),
  brand: z.string().max(100).optional(),
  latestRefPrice: z.number().nonnegative().optional(),
  season: z.string().max(50).default("四季"),
  storage: z.string().max(50).default("常温"),
});

export const ingredientQuerySchema = z.object({
  l2Code: z.string().optional(),
});
