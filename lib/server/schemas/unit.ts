import { z } from "zod";

export const UNIT_CATEGORIES = ["weight", "volume", "count", "other"] as const;

const categoryField = z.enum(UNIT_CATEGORIES);
const isActiveField = z.boolean();

// 默认值只放 create 侧：Zod 4 的 .partial() 会保留 .default()，
// 若 update 基座带默认值，部分更新缺省会覆盖存量（如漏传 isActive 把停用单位强制激活）
export const createUnitSchema = z.object({
  name: z.string().min(1).max(50),
  category: categoryField.default("other"),
  // 重量类单位必填（API 层校验），1 单位合多少克；非重量类为 null
  gramsPerUnit: z.number().positive().nullish(),
  isActive: isActiveField.default(true),
});

export const updateUnitSchema = z
  .object({
    name: z.string().min(1).max(50),
    gramsPerUnit: z.number().positive().nullish(),
  })
  .partial()
  .extend({
    category: categoryField.optional(),
    isActive: isActiveField.optional(),
  });
