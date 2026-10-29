import { z } from "zod";

export const UNIT_CATEGORIES = ["weight", "volume", "count", "other"] as const;

export const createUnitSchema = z.object({
  name: z.string().min(1).max(50),
  category: z.enum(UNIT_CATEGORIES).default("other"),
  // 重量类单位必填（API 层校验），1 单位合多少克；非重量类为 null
  gramsPerUnit: z.number().positive().nullish(),
  isActive: z.boolean().default(true),
});

export const updateUnitSchema = createUnitSchema.partial();
