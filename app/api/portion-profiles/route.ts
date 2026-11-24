import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { paginated, conflict, internalError } from "@/lib/server/api-response";
import { paginationQuerySchema } from "@/lib/server/schemas/common";
import { createPortionProfileSchema } from "@/lib/server/schemas/portion-profile";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // 业务端下拉用全量启用行（不分页）；设置页走默认分页分支
    if (searchParams.get("all") === "1") {
      const rows = await prisma.portionProfile.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return NextResponse.json({ success: true, data: rows });
    }

    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    // 业务端默认只返回启用中的份量；设置页传 includeInactive=1 获取全量
    const includeInactive = searchParams.get("includeInactive") === "1";
    const where: Prisma.PortionProfileWhereInput = includeInactive ? {} : { isActive: true };
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.portionProfile.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.portionProfile.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取份量档案失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createPortionProfileSchema, body);
    if (!validation.success) return validation.response;

    const { portion, scenario, multiplier, isActive } = validation.data;
    const maxSort = await prisma.portionProfile.aggregate({ _max: { sortOrder: true } });
    const row = await prisma.portionProfile.create({
      data: {
        portion,
        scenario,
        multiplier,
        isActive: isActive ?? true,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    await logOperation(req, { action: "CREATE", entity: "PortionProfile", entityId: row.id, description: `创建: ${row.portion}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    // 份量标签全表唯一：有意返回 409（区别于 dish-categories 模板的 400），
    // 语义是「与现有资源冲突」而非「请求参数错误」，前端据此提示用户换标签
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return conflict("该份量标签已存在");
    }
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
