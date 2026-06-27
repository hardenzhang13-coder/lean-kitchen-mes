import { z } from "zod";

export const createDishCategorySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
});

export const updateDishCategorySchema = createDishCategorySchema.partial();
