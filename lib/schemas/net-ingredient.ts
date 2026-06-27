import { z } from "zod";

export const createNetIngredientSchema = z.object({
  name: z.string().min(1).max(100),
  sourceIngredientId: z.number().int().positive().nullish(),
  spec: z.string().max(200).nullish(),
  yieldRate: z.number().min(1).max(100).nullish(),
  unitPrice: z.number().nonnegative().nullish(),
  l2Code: z.string().min(1).max(20),
  autoCalculate: z.boolean().default(true),
});

export const updateNetIngredientSchema = createNetIngredientSchema.partial();

export const netIngredientQuerySchema = z.object({
  sourceIngredientId: z.coerce.number().int().positive().optional(),
  l1Code: z.string().optional(),
  l2Code: z.string().optional(),
  excludeMinor: z.coerce.boolean().optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
