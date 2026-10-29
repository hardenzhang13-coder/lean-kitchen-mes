import { prisma } from "./prisma";
import { normalizeName } from "@/lib/shared/name-utils";

export async function checkDuplicateName(
  name: string,
  options?: {
    excludeId?: number;
  }
): Promise<{ exists: boolean }> {
  const normalized = normalizeName(name);
  if (!normalized) return { exists: false };

  const ingredients = await prisma.ingredient.findMany({
    where: {
      deletedAt: null,
      ...(options?.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: { id: true, name: true },
  });

  for (const ing of ingredients) {
    if (normalizeName(ing.name) === normalized) {
      return { exists: true };
    }
  }
  return { exists: false };
}
