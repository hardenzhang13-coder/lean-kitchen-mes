export interface ApiList<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T | ApiList<T>;
  error?: string;
  code?: string;
}

/**
 * 解析列表类 API 响应。
 * 兼容：裸数组、{ data: array }、{ data: { items, ...pagination } }、{ success: true, data: ... }
 */
export async function parseList<T>(res: Response): Promise<T[]> {
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (json?.success === true && json.data) {
    const data = json.data as ApiList<T> | T[];
    return Array.isArray(data) ? data : data.items ?? [];
  }
  const data = json?.data;
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

/**
 * 解析对象类 API 响应。
 * 兼容：裸对象、{ data: object }、{ success: true, data: object }
 */
export async function parseObject<T>(res: Response): Promise<T | null> {
  const json = await res.json();
  if (json?.success === true) return (json.data as T) ?? null;
  if (json && typeof json === "object" && !Array.isArray(json) && !json.error) {
    return (json.data as T) ?? json;
  }
  return null;
}

/**
 * 通用解析，返回标准结构。
 */
export async function parseResponse<T>(
  res: Response
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const json = await res.json();
  if (json?.success === true) {
    return { success: true, data: json.data as T };
  }
  if (json?.success === false || json?.error) {
    return { success: false, error: json.error as string };
  }
  return { success: true, data: json as T };
}
