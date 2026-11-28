import { z } from "zod";

// 分类编号约定：英文字母开头，可含数字与连字符（如 VEG、VEG-LEF、PIG-COL）。
// 中文编号会破坏前缀派生（色板/分组）且无法级联改名，故在入口拦截。
const categoryCodeSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)*$/, "编号仅支持英文字母、数字与连字符（如 VEG、VEG-LEF）");

// 分类域：food=食材分类 / seasoning=调味品分类（三表共用，code 命名空间共享）
export const categoryDomainSchema = z.enum(["food", "seasoning"]);

export const createIngredientCategorySchema = z.object({
  type: z.enum(["l1", "l2", "l3"]),
  code: categoryCodeSchema,
  name: z.string().min(1).max(100),
  parentCode: z.string().min(1).max(50).optional(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  // 仅 l1 创建时生效；l2/l3 的 domain 强制继承父级
  domain: categoryDomainSchema.optional(),
});

export const updateIngredientCategorySchema = createIngredientCategorySchema.partial();
/** 批量排序：l1 全局排序；l2 同一父级（L1）内排序；l3 同一父级（L2）内排序 */
export const reorderIngredientCategoriesSchema = z.object({
  type: z.enum(["l1", "l2", "l3"]),
  ids: z.array(z.number().int().positive()).min(1),
});
