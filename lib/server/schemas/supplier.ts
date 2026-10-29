import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().min(1).max(100),
  contact: z.string().max(100).nullish(),
  phone: z.string().max(50).nullish(),
  remark: z.string().max(500).nullish(),
});

export const updateSupplierSchema = createSupplierSchema.partial();
