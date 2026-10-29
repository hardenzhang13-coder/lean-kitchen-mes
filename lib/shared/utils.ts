import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { pinyin } from "pinyin-pro"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  if (!name) return ""
  const first = name.charAt(0)
  if (/^[a-zA-Z]/.test(first)) return first.toUpperCase()
  const py = pinyin(first, { toneType: "none", type: "array" })
  if (py.length > 0 && py[0]) return py[0].charAt(0).toUpperCase()
  return first.toUpperCase()
}

/**
 * 计算 base64 图片字符串的简易特征哈希，用于重复图片检测。
 * 非加密安全，仅用于同一系统内的去重标识。
 */
export function computeImageHash(base64: string): string {
  let hash = 5381;
  for (let i = 0; i < base64.length; i++) {
    hash = ((hash << 5) + hash) + base64.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
  return `${Math.floor(diffDay / 365)}年前`;
}

export function formatNumber(n: number, decimals = 2): string {
  return Number(n).toFixed(decimals);
}

export function groupBy<T, K extends string | number>(
  arr: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
