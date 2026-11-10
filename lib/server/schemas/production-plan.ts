import { z } from "zod";

export const createProductionPlanSchema = z.object({
  title: z.string().min(1).max(100),
  planDate: z.string().min(4).max(20),
  scheduleIds: z.array(z.number().int().positive()).min(1).max(100),
});

export const productionPlanQuerySchema = z.object({
  status: z.string().max(20).optional(),
  startDate: z.string().max(20).optional(),
  endDate: z.string().max(20).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
