/**
 * 列表与详情共用的展示格式化。
 * 列表表头只描述字段语义，单位由数值行统一携带。
 */
export function formatMoney(
  value: unknown,
  unit?: string | null,
  fallback = "—"
): string {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `¥${number.toFixed(2)}${unit ? `/${unit}` : ""}`;
}

/** 毛利率等百分比字段的空值统一按 0 处理。 */
export function formatPercent(value: unknown, fallback = 0): string {
  const number = value == null || value === "" ? fallback : Number(value);
  return `${Number.isFinite(number) ? number : fallback}%`;
}

/** 数值 + 单一单位，如 500 g/单位、3 份。 */
export function formatUnitValue(
  value: unknown,
  unit: string,
  fallback = "—",
  separator = ""
): string {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return `${number}${separator}${unit}`;
}

/**
 * 日期时间展示：2026-11-15 21:30（本地时区）。
 * 用于建档时间、更新时间等只在详情页出现的时间字段。
 */
export function formatDateTime(value: unknown, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
