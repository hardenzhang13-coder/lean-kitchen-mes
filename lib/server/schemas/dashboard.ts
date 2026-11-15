import { z } from "zod";

export const dashboardWeeklyQuerySchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate 不能晚于 endDate",
  });