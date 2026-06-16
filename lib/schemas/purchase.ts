import { z } from "zod";

export const purchaseReceiptItemSchema = z.object({
  ingredientId: z.number().int().positive().nullish(),
  seasoningIngredientId: z.number().int().positive().nullish(),
  itemName: z.string().min(1).max(100),
  brand: z.string().max(100).nullish(),
  l2Code: z.string().max(20).nullish(),
  l2Name: z.string().max(50).nullish(),
  isManual: z.boolean().default(false),
  spec: z.string().min(1).max(200),
  qty: z.number().positive(),
  priceUnit: z.string().min(1).max(20).optional(),
  purchaseUnit: z.string().min(1).max(20).optional(),
  unitPrice: z.number().nonnegative(),
  amount: z.number().nonnegative(),
  stockUnit: z.string().min(1).max(20),
  stockInQty: z.number().nonnegative(),
  storage: z.string().max(50).default("常温"),
});

export const createPurchaseReceiptSchema = z.object({
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.number().int().positive().nullish(),
  supplierName: z.string().max(100).nullish(),
  summary: z.string().max(500).nullish(),
  totalAmount: z.number().nonnegative(),
  imageUrl: z.string().url().nullish(),
  items: z.array(purchaseReceiptItemSchema).min(1),
});

export const purchaseReceiptQuerySchema = z.object({
  status: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
