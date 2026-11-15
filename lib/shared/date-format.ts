const WEEKDAY_LABELS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

export function getWeekDay(dateStr: string): string {
  return WEEKDAY_LABELS[new Date(dateStr).getDay()];
}

/** 短星期：周二 */
export function getWeekDayShort(dateStr: string): string {
  return WEEKDAY_LABELS[new Date(dateStr).getDay()].replace("星期", "周");
}

/** 中文月日：11月21日 */
export function formatMonthDayCn(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

/** 卡片摘要用的短日期：11-16 */
export function formatMonthDay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 相对今天偏移 N 天的日期输入值（本地时区，不用 toISOString 避免跨日）。 */
export function dayOffsetInputValue(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}
