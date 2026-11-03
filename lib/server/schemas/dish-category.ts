import { z } from "zod";

// 与食材分类一致的编号约定：英文字母开头，可含数字与连字符（如 PORK、SOUP）
const categoryCodeSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)*$/, "编号仅支持英文字母、数字与连字符（如 PORK）");

export const createDishCategorySchema = z.object({
  code: categoryCodeSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
});

export const updateDishCategorySchema = createDishCategorySchema.partial();
