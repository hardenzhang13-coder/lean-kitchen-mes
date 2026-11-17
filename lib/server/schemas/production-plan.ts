import { z } from "zod";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

const idArraySchema = z.array(z.number().int().positive()).max(100);

export const createProductionPlanSchema = z
  .object({
    /** 标题由服务端按「生产计划 · 周几（月日）」生成，客户端传值会被忽略 */
    title: z.string().max(100).optional(),
    planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduleIds: idArraySchema.default([]),
    selfOrderIds: idArraySchema.default([]),
  })
  .superRefine((value, ctx) => {
    if (value.scheduleIds.length === 0 && value.selfOrderIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduleIds"],
        message: "请至少选择一张排程单或内部生产单",
      });
    }
  });

/** 修改时 selfOrderIds 可省略：省略表示保留现有内部生产单关联。 */
export const updateProductionPlanSchema = z.object({
  title: z.string().max(100).optional(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleIds: idArraySchema.default([]),
  selfOrderIds: idArraySchema.optional(),
});

export const productionPlanQuerySchema = z.object({
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
