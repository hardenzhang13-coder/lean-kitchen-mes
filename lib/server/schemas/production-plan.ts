import { z } from "zod";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

const idArraySchema = z.array(z.number().int().positive()).max(100);

/** 生产计划单行级份数调整：sourceType 由服务端派生（2026-11-28 起恒为 net），客户端只传净料与份数 */
export const planPortionAdjustmentSchema = z
  .object({
    sourceId: z.number().int().positive(),
    portions: z.number().min(0).max(100000),
  })
  .strict();

export type PlanPortionAdjustment = z.infer<typeof planPortionAdjustmentSchema>;

const adjustmentsSchema = z.array(planPortionAdjustmentSchema).max(500).superRefine((value, ctx) => {
  const seen = new Set<number>();
  for (const adj of value) {
    if (seen.has(adj.sourceId)) {
      ctx.addIssue({ code: "custom", path: ["sourceId"], message: "同一净料只能出现一次调整" });
      return;
    }
    seen.add(adj.sourceId);
  }
});

const planBodyShape = {
  /** 标题由服务端派生（切配中心·周几（月日）切配计划），客户端传值会被忽略 */
  title: z.string().max(100).optional(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 必填备注：卡片明细区展示 */
  remark: z.string().trim().min(1, "请填写备注").max(200),
  /** 允许为空 = 纯手工切配计划（不关联门店排程） */
  scheduleIds: idArraySchema.min(0).max(100),
  /** 全部计划行（含未修改行）的最终份数；缺省 = 完全按排程基线 */
  adjustments: adjustmentsSchema.optional(),
};

function requirePositivePortionWhenNoSchedule(value: { scheduleIds: number[]; adjustments?: { portions: number }[] }, ctx: z.RefinementCtx) {
  if (value.scheduleIds.length > 0) return;
  const hasPositive = (value.adjustments ?? []).some((adj) => adj.portions > 0);
  if (!hasPositive) {
    ctx.addIssue({ code: "custom", path: ["adjustments"], message: "未选择排程单时，至少一行计划切配份数大于 0" });
  }
}

export const createProductionPlanSchema = z
  .object(planBodyShape)
  .strict()
  .superRefine(requirePositivePortionWhenNoSchedule);

/** 修改与新建同构：scheduleIds + adjustments 全量提交，服务端按当前档案重算快照。 */
export const updateProductionPlanSchema = z
  .object(planBodyShape)
  .strict()
  .superRefine(requirePositivePortionWhenNoSchedule);

export const productionPlanQuerySchema = z.object({
  status: z.enum(SCHEDULE_STATUS_VALUES).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** 预览聚合：逗号分隔的排程单 id（允许为空串 = 纯手工切配计划预览空基线） */
export const productionPlanPreviewQuerySchema = z.object({
  scheduleIds: z
    .string()
    .regex(/^\d*(,\d+)*$/, "scheduleIds 须为逗号分隔的数字")
    .transform((s) => (s === "" ? [] : s.split(",").map(Number)))
    .pipe(z.array(z.number().int().positive()).max(100)),
});
