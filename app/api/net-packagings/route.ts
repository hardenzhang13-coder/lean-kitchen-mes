import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import {
  conflict,
  created,
  internalError,
  paginated,
} from "@/lib/server/api-response";
import { createNetPackagingSchema, netPackagingQuerySchema } from "@/lib/server/schemas/net-packaging";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";

async function findSamePair(name: string, size: string, excludeId?: number) {
  return prisma.netPackaging.findFirst({
    where: {
      name,
      size,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(netPackagingQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { q, includeInactive, page, pageSize } = validation.data;
    const where: Prisma.NetPackagingWhereInput = { deletedAt: null };
    if (!includeInactive) where.isActive = true;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [{ name: { contains: term } }, { size: { contains: term } }];
    }

    const skip = (page - 1) * pageSize;
    const [rows, totalItems] = await Promise.all([
      prisma.netPackaging.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.netPackaging.count({ where }),
    ]);

    return paginated(rows, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/net-packagings failed");
    return internalError("获取净菜包装失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createNetPackagingSchema, body);
    if (!validation.success) return validation.response;

    const { name, size, isActive } = validation.data;

    const existing = await findSamePair(name, size);
    if (existing && !existing.deletedAt) {
      return conflict("该包装名称与尺寸已存在");
    }

    // 软删除记录重新创建时直接恢复，避免唯一索引导致无法再次添加
    const row = existing
      ? await prisma.netPackaging.update({
          where: { id: existing.id },
          data: { deletedAt: null, isActive, name, size },
        })
      : await prisma.netPackaging.create({ data: { name, size, isActive } });

    await logOperation(req, {
      action: existing ? "RESTORE" : "CREATE",
      entity: "NetPackaging",
      entityId: row.id,
      description: `${existing ? "恢复" : "创建"}净菜包装: ${row.name} / ${row.size}`,
    });

    return created(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return conflict("该包装名称与尺寸已存在");
    }
    logger.error({ err }, "POST /api/net-packagings failed");
    return internalError("创建净菜包装失败");
  }
}
