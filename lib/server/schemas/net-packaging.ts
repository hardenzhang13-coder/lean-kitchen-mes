import { z } from "zod";
import { paginationQuerySchema } from "./common";

const nameSchema = z
  .string()
  .trim()
  .min(1, "包装名称不能为空")
  .max(50, "包装名称不能超过 50 字");
const sizeSchema = z
  .string()
  .trim()
  .min(1, "包装尺寸不能为空")
  .max(100, "包装尺寸不能超过 100 字");

export const createNetPackagingSchema = z.object({
  name: nameSchema,
  size: sizeSchema,
  isActive: z.boolean().default(true),
});

export const updateNetPackagingSchema = z.object({
  name: nameSchema.optional(),
  size: sizeSchema.optional(),
  isActive: z.boolean().optional(),
});

export const netPackagingQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(100).optional(),
  /** 设置页/表单需要展示停用项时传 1 */
  includeInactive: z.enum(["1", "true"]).optional(),
});
