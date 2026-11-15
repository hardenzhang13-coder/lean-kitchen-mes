import { formatMonthDayCn, getWeekDayShort } from "./date-format";

/**
 * 生产计划单标题的固定格式：`切配中心·周二（11月21日）生产计划`。
 *
 * 计划单跨店汇总，标题由生产日期推导，不在表单里填写；同日多张计划靠编号区分。
 */
export function buildProductionPlanTitle(planDate: string): string {
  return `切配中心·${getWeekDayShort(planDate)}（${formatMonthDayCn(planDate)}）生产计划`;
}
