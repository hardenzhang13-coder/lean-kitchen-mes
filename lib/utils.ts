import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { pinyin } from "pinyin-pro"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs))
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
