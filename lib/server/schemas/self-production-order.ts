import { z } from "zod";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

/** 份数最多 2 位小数（与 Decimal(12,2) 对齐）。 */
function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export const selfProductionItemInputSchema = z.object({
  sourceId: z.number().int().positive(),
  portions: z
    .number()
    .positive()
    .max(100000)
    .refine(hasAtMostTwoDecimals, "份数最多保留 2 位小数"),
});

/** 同一净料只能出现一次：重复行会产生两条相同切配口径。 */
function noDuplicateSources(
  items: Array<{ sourceId: number }>,
  ctx: z.RefinementCtx
) {
  const seen = new Set<number>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.sourceId)) {
      ctx.addIssue({
        code: "custom",
        message: "同一净料只能填写一次，请合并份数",
        path: [index],
      });
      return;
    }
    seen.add(item.sourceId);
  }
}

export const createSelfProductionOrderSchema = z.object({
  /** 标题由服务端按「切配中心·周几（月日）内部生产单」生成，客户端传值会被忽略 */
  title: z.string().max(200).optional(),
  produceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(selfProductionItemInputSchema)
    .min(1)
    .max(500)
    .superRefine(noDuplicateSources),
  remark: z.string().max(200).optional(),
});

export const updateSelfProductionOrderSchema = createSelfProductionOrderSchema;

export const selfProductionOrderQuerySchema = z.object({
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  availableForPlan: z.enum(["0", "1"]).transform((value) => value === "1").optional(),
  excludePlanId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SelfProductionItemInput = z.infer<typeof selfProductionItemInputSchema>;
