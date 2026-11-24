import { ROLES, isAdmin, isChef, isOperations } from "@/lib/shared/roles";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

/** 页面级导航权限。页面内按钮仍以后端 API 权限为准。 */
export function canAccessPage(pathname: string, role?: string | null): boolean {
  if (!isAdmin(role) && !isOperations(role) && !isChef(role) && role !== ROLES.PURCHASE) {
    return false;
  }

  if (pathname === "/forbidden") return true;
  if (pathname.startsWith("/settings/profile")) return true;
  if (pathname.startsWith("/settings/users")) return isAdmin(role);
  if (pathname.startsWith("/settings")) return isAdmin(role) || isOperations(role);
  if (
    pathname.startsWith("/schedules") ||
    pathname.startsWith("/production-plans")
  ) {
    // 业务运营需要查看排程与计划单；写操作仍由 API 层限制为 admin/chef。
    return isAdmin(role) || isChef(role) || isOperations(role);
  }
  if (
    pathname.startsWith("/inventory/outbound/new") ||
    pathname.match(/^\/inventory\/outbound\/[^/]+$/)
  ) {
    return isAdmin(role) || isOperations(role);
  }
  return true;
}

/**
 * API 权限集中表。新增 API 若未明确登记，默认只有管理员可访问，避免遗漏授权。
 */
export function canAccessApi(
  pathname: string,
  method: string,
  role?: string | null
): boolean {
  if (!isAdmin(role) && !isOperations(role) && !isChef(role) && role !== ROLES.PURCHASE) {
    return false;
  }

  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/users/profile")) return true;
  if (pathname.startsWith("/api/users")) return isAdmin(role);
  if (pathname.startsWith("/api/dashboard")) return true;
  if (pathname.startsWith("/api/purchase-") || pathname === "/api/upload") {
    return isAdmin(role) || role === ROLES.PURCHASE;
  }

  const write = isWriteMethod(method);

  if (
    pathname.startsWith("/api/schedules") ||
    pathname.startsWith("/api/production-plans")
  ) {
    return !write || isAdmin(role) || isChef(role);
  }

  // 内部生产单页面已下线，API 仅保留只读（历史计划单快照展示依赖），写入口全部关闭
  if (pathname.startsWith("/api/self-production-orders")) {
    return !write;
  }

  if (pathname.startsWith("/api/outbound-orders") || pathname.startsWith("/api/prepped-stock")) {
    return !write || isAdmin(role) || isOperations(role);
  }

  const masterDataPrefixes = [
    "/api/dishes",
    "/api/ingredients",
    "/api/net-ingredients",
    "/api/standard-seasonings",
    "/api/sauce-ingredients",
    "/api/dish-categories",
    "/api/portion-profiles",
    "/api/ingredient-categories",
    "/api/units",
    "/api/net-packagings",
    "/api/stores",
    "/api/suppliers",
  ];
  if (masterDataPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return !write || isAdmin(role) || isOperations(role);
  }

  return isAdmin(role);
}
