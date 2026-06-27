import { z } from "zod";

export const createIngredientCategorySchema = z.object({
  type: z.enum(["l1", "l2"]),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  parentCode: z.string().min(1).max(50).optional(),
  description: z.string().max(500).nullish(),
});

export const updateIngredientCategorySchema = createIngredientCategorySchema.partial();
