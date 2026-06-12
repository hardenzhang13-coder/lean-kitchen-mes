import { prisma } from "./prisma";

export async function resolveUsernameToName(username: string | null): Promise<string | null> {
  if (!username) return null;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { name: true },
  });
  return user?.name || username;
}

export async function enrichOperatorNames<T extends { operator: string | null }>(
  rows: T[]
): Promise<(T & { operatorName: string | null })[]> {
  const usernames = [...new Set(rows.map((r) => r.operator).filter((x): x is string => !!x))];
  if (usernames.length === 0) {
    return rows.map((r) => ({ ...r, operatorName: r.operator }));
  }

  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { username: true, name: true },
  });

  const map = new Map(users.map((u) => [u.username, u.name || u.username]));

  return rows.map((r) => ({
    ...r,
    operatorName: r.operator ? map.get(r.operator) || r.operator : null,
  }));
}
