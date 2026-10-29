import { prisma } from "./prisma";

export async function resolveUsernameToName(username: string | null): Promise<string | null> {
  if (!username) return null;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true },
  });
  return user?.name || username;
}

/** 批量解析 username → 展示名（无 name 时回退 username），返回 username→name 的 Map。 */
export async function resolveUsernamesToNames(
  usernames: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(usernames.filter((x): x is string => !!x))];
  if (unique.length === 0) return map;

  const users = await prisma.user.findMany({
    where: { username: { in: unique } },
    select: { username: true, name: true },
  });
  for (const u of users) {
    map.set(u.username, u.name || u.username);
  }
  return map;
}

export async function enrichOperatorNames<T extends { operator: string | null }>(
  rows: T[]
): Promise<(T & { operatorName: string | null })[]> {
  const usernames = [...new Set(rows.map((r) => r.operator).filter((x): x is string => !!x))];
  if (usernames.length === 0) {
    return rows.map((r) => ({ ...r, operatorName: r.operator }));
  }

  const map = await resolveUsernamesToNames(usernames);

  return rows.map((r) => ({
    ...r,
    operatorName: r.operator ? map.get(r.operator) || r.operator : null,
  }));
}
