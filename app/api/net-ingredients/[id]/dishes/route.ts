import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { paginated, notFound, internalError } from "@/lib/server/api-response";
import { validateQuery } from "@/lib/server/validate";
import { paginationQuerySchema } from "@/lib/server/schemas/common";

/**
 * 净料被哪些菜品引用。
 * 主料/辅料/小料统一走 dish_net_details（小料行 role='minor'，2026-11-28 起并入）。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const netIngId = Number(id);
    if (!Number.isInteger(netIngId) || netIngId <= 0) {
      return notFound("净料不存在");
    }

    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;
    const { page, pageSize } = validation.data;

    const exists = await prisma.netIngredient.findFirst({
      where: { id: netIngId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) return notFound("净料不存在或已删除");

    const where: Prisma.DishWhereInput = {
      netDetails: { some: { netIngId } },
    };

    const [rows, totalItems] = await Promise.all([
      prisma.dish.findMany({
        where,
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, code: true, name: true, portion: true },
      }),
      prisma.dish.count({ where }),
    ]);

    return paginated(rows, {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    });
  } catch {
    return internalError("获取关联菜品失败");
  }
}
