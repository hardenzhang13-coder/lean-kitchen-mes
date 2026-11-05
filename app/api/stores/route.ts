import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { created, paginated, internalError, conflict, badRequest } from "@/lib/server/api-response";
import { createStoreSchema, storeQuerySchema } from "@/lib/server/schemas/store";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { nextCode } from "@/lib/shared/code-gen";
import { normalizeName } from "@/lib/shared/name-utils";
import { logger } from "@/lib/server/logger";

/** 归一化重名查重（排除已软删除门店） */
async function findStoreByName(name: string, excludeId?: number) {
  const normalized = normalizeName(name);
  const stores = await prisma.store.findMany({
    where: { deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  return stores.find((s) => normalizeName(s.name) === normalized) ?? null;
}

/** 生成下一个门店编号：取最大编号后缀 +1（ST-0001 起） */
async function generateStoreCode() {
  const last = await prisma.store.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return nextCode("ST", last?.code);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(storeQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { q, activeOnly, page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StoreWhereInput = { deletedAt: null };
    if (activeOnly) where.isActive = true;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term } },
        { code: { contains: term } },
        { manager: { contains: term } },
      ];
    }

    const [rows, totalItems] = await Promise.all([
      prisma.store.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
        include: { _count: { select: { schedules: true } } },
      }),
      prisma.store.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch (err) {
    logger.error({ err }, "GET /api/stores failed");
    return internalError("获取门店失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createStoreSchema, body);
    if (!validation.success) return validation.response;

    const { name, manager, phone, address } = validation.data;
    const trimmedName = name.trim();
    if (!trimmedName) return badRequest("门店名称不能为空");

    const dup = await findStoreByName(trimmedName);
    if (dup) return conflict(`门店名称已存在: ${dup.name}`);

    const row = await prisma.store.create({
      data: {
        code: await generateStoreCode(),
        name: trimmedName,
        manager: manager?.trim() || null,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
      },
    });
    await logOperation(req, {
      action: "CREATE",
      entity: "Store",
      entityId: row.id,
      description: `创建门店: ${row.name}`,
    });
    return created(row);
  } catch (err) {
    logger.error({ err }, "POST /api/stores failed");
    return internalError("创建门店失败");
  }
}
