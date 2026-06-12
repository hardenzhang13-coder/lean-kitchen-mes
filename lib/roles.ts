export const ROLES = {
  ADMIN: "系统管理员",
  OPERATIONS: "业务运营",
  CHEF: "厨师长",
  PURCHASE: "采购",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "系统管理员" },
  { value: ROLES.OPERATIONS, label: "业务运营" },
  { value: ROLES.CHEF, label: "厨师长" },
  { value: ROLES.PURCHASE, label: "采购" },
];

export function isAdmin(role?: string | null): boolean {
  return role === ROLES.ADMIN;
}
