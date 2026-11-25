import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/server/prisma";
import type { PortionProfileLike } from "@/lib/shared/portion-scale";

type Db = PrismaClient | Prisma.TransactionClient;

const PROFILE_SELECT = {
  portion: true,
  scenario: true,
  multiplier: true,
  isBase: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.PortionProfileSelect;

/** 全部份量档案行（含停用），供倍率计算与更新校验 */
export async function listPortionProfiles(db: Db = prisma): Promise<PortionProfileLike[]> {
  return db.portionProfile.findMany({
    select: PROFILE_SELECT,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/** 启用中的份量档案行（业务端下拉选项） */
export async function listActivePortionProfiles(
  db: Db = prisma
): Promise<PortionProfileLike[]> {
  return db.portionProfile.findMany({
    where: { isActive: true },
    select: PROFILE_SELECT,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/**
 * 新建写校验：份量必须命中启用中的档案行。
 * 返回 null 表示通过，否则返回可读错误文案。
 */
export async function validatePortionForCreate(
  portion: string,
  db: Db = prisma
): Promise<string | null> {
  const row = await db.portionProfile.findUnique({
    where: { portion },
    select: { isActive: true },
  });
  if (row) {
    return row.isActive ? null : `份量「${portion}」已停用，请先在设置-份量中启用`;
  }
  return `份量「${portion}」不存在，请先在设置-份量中维护`;
}

/**
 * 更新写校验：允许保持现值（含档案已删除/停用的存量值），否则须命中档案行
 * （任意状态，避免停用行无法保存其他字段）。
 */
export async function validatePortionForUpdate(
  portion: string,
  current: string | null | undefined,
  db: Db = prisma
): Promise<string | null> {
  if (portion === current) return null;
  const row = await db.portionProfile.findUnique({
    where: { portion },
    select: { isActive: true },
  });
  if (row) return null;
  return `份量「${portion}」不存在，请先在设置-份量中维护`;
}

/**
 * 菜品转化源校验：仅单人份（当前基本单元）可作为源；
 * 场景规格只能由单人份倍率推导，禁止互相转化。
 * 返回 null 表示通过，否则返回可读错误文案。
 */
export async function validatePortionSourceForScale(
  portion: string,
  db: Db = prisma
): Promise<string | null> {
  const row = await db.portionProfile.findFirst({
    where: { portion, isBase: true, isActive: true },
    select: { id: true },
  });
  return row ? null : "只有单人份菜品可转化为其它份量";
}

/**
 * 门店场景写校验：scenario 必须命中份量档案出现过的场景值
 * （含停用行——历史门店场景不应因档案停用而失效）。
 * 返回 null 表示通过，否则返回可读错误文案。
 */
export async function validateStoreScenario(
  scenario: string,
  db: Db = prisma
): Promise<string | null> {
  const row = await db.portionProfile.findFirst({
    where: { scenario },
    select: { id: true },
  });
  if (row) return null;
  return `场景「${scenario}」不存在，请先在设置-份量中维护`;
}
