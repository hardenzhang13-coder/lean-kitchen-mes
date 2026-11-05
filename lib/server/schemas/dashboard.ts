import { z } from "zod";

export const dashboardDailyQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  storeId: z.coerce.number().int().positive().default(1),
});