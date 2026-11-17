import { formatMonthDayCn, getWeekDayShort } from "./date-format";

/**
 * 内部生产单标题的固定格式：`切配中心·周二（11月18日）内部生产单`。
 *
 * 切配中心是系统内置的单一生产主体，标题由生产日期推导，不在表单里填写。
 */
export function buildSelfProductionOrderTitle(produceDate: string): string {
  return `切配中心·${getWeekDayShort(produceDate)}（${formatMonthDayCn(produceDate)}）内部生产单`;
}
