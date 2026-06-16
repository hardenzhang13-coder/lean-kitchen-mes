import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
