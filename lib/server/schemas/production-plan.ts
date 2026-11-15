import { z } from "zod";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

export const createProductionPlanSchema = z.object({
  /** 标题由服务端按「生产计划 · 周几（月日）」生成，客户端传值会被忽略 */
  title: z.string().max(100).optional(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: z.array(z.number().int().positive()).min(1).max(100),
});

export const updateProductionPlanSchema = createProductionPlanSchema;

export const productionPlanQuerySchema = z.object({
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
