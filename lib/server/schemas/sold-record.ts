import { z } from "zod";

/** 单条回录明细：soldQty 为 null 表示清除回录（回到未回录态） */
export const soldRecordItemSchema = z.object({
  itemId: z.number().int().positive(),
  soldQty: z.number().int().min(0).max(9999).nullable(),
});

/** 批量写入销售回录（手动/导入共用） */
export const createSoldRecordsSchema = z.object({
  items: z.array(soldRecordItemSchema).min(1),
  source: z.enum(["manual", "import"]),
  fileName: z.string().max(200).optional(),
});