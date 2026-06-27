import { z } from "zod";

export const createPurchaseReimbursementSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(500).nullish(),
  receiptIds: z.array(z.number().int().positive()).min(1),
});
