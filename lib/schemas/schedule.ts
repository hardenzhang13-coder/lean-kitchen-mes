import { z } from "zod";

export const scheduleStatusSchema = z.enum(["待生效", "进行中", "已完成"]);

export const scheduleItemSchema = z.object({
  dishId: z.number().int().positive(),
  quantity: z.number().int().min(1),
});

export const createScheduleSchema = z.object({
  title: z.string().min(1).max(200),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scope: z.string().max(100).default("全部食堂"),
  items: z.array(scheduleItemSchema).min(1),
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scope: z.string().max(100).optional(),
  items: z.array(scheduleItemSchema).optional(),
});

export const scheduleQuerySchema = z.object({
  status: scheduleStatusSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
});
