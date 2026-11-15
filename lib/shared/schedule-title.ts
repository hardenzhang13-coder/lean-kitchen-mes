import { formatMonthDayCn, getWeekDayShort } from "./date-format";

/**
 * 菜品排程单标题的固定格式：`门店名称 · 周二（11月21日）·菜单`。
 *
 * 标题由门店与售卖日期推导，不在表单里手填。
 */
export function buildScheduleTitle(
  storeName: string,
  scheduleDate: string
): string {
  return `${storeName} · ${getWeekDayShort(scheduleDate)}（${formatMonthDayCn(
    scheduleDate
  )}）·菜单`;
}
