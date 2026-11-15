import { z } from "zod";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

export const scheduleStatusSchema = z.enum(SCHEDULE_STATUS_VALUES);

export const scheduleItemSchema = z.object({
  dishId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

/** 同一道菜只能出现一次：重复行会让切配/采购只按第一行计算。 */
function noDuplicateDishes(
  items: Array<{ dishId: number }>,
  ctx: z.RefinementCtx
) {
  const seen = new Set<number>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.dishId)) {
      ctx.addIssue({
        code: "custom",
        message: "同一道菜只能选择一次，请合并份数",
        path: [index],
      });
      return;
    }
    seen.add(item.dishId);
  }
}

export const createScheduleSchema = z.object({
  /** 标题由服务端按「门店 · 周几（月日）·菜单」生成，客户端传值会被忽略 */
  title: z.string().max(200).optional(),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  storeId: z.number().int().positive(),
  items: z.array(scheduleItemSchema).min(1).superRefine(noDuplicateDishes),
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  storeId: z.number().int().positive().optional(),
  items: z.array(scheduleItemSchema).superRefine(noDuplicateDishes).optional(),
});

export const scheduleQuerySchema = z.object({
  status: scheduleStatusSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  storeId: z.coerce.number().int().positive().optional(),
  availableForPlan: z.enum(["0", "1"]).transform((value) => value === "1").optional(),
  excludePlanId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
