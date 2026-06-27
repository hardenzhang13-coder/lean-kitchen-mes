import { z } from "zod";

export const UNIT_CATEGORIES = ["weight", "volume", "count", "other"] as const;

export const createUnitSchema = z.object({
  name: z.string().min(1).max(50),
  category: z.enum(UNIT_CATEGORIES).default("other"),
});

export const updateUnitSchema = createUnitSchema.partial();
