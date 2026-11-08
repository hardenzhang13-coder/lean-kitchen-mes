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
 * 统一 401 处理：session 过期时跳转登录页并给出人性化提示。
 * 返回 true 表示已处理（调用方应立即返回空结果，避免继续解析错误响应）。
 */
export function redirectToLoginOnUnauthorized(res: Response): boolean {
  if (res.status !== 401) return false;
  if (typeof window !== "undefined") {
    window.location.href = "/login?expired=1";
  }
  return true;
}

/**
 * 解析列表类 API 响应。
 * 兼容：裸数组、{ data: array }、{ data: { items, ...pagination } }、{ success: true, data: ... }
 */
export async function parseList<T>(res: Response): Promise<T[]> {
  if (redirectToLoginOnUnauthorized(res)) return [];
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
  if (redirectToLoginOnUnauthorized(res)) return null;
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
  if (redirectToLoginOnUnauthorized(res)) {
    return { success: false, error: "登录已过期，请重新登录" };
  }
  const json = await res.json();
  if (json?.success === true) {
    return { success: true, data: json.data as T };
  }
  if (json?.success === false || json?.error) {
    return { success: false, error: json.error as string };
  }
  return { success: true, data: json as T };
}
