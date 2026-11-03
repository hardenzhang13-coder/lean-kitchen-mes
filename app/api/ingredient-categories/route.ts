import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { paginated, internalError } from "@/lib/server/api-response";
import { paginationQuerySchema } from "@/lib/server/schemas/common";
import { createIngredientCategorySchema } from "@/lib/server/schemas/ingredient-category";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const type = searchParams.get("type");
    // 业务端默认只返回启用中的分类；设置页传 includeInactive=1 获取全量
    const includeInactive = searchParams.get("includeInactive") === "1";
    const skip = (page - 1) * pageSize;

    if (type === "l1") {
      const where = includeInactive ? {} : { isActive: true };
      const [rows, totalItems] = await Promise.all([
        prisma.ingredientCategoryL1.findMany({
          where,
          orderBy: { id: "asc" },
          skip,
          take: pageSize,
        }),
        prisma.ingredientCategoryL1.count({ where }),
      ]);
      const totalPages = Math.ceil(totalItems / pageSize);
      return paginated(rows, { page, pageSize, totalItems, totalPages });
    }

    if (type === "l2") {
      const where = includeInactive ? {} : { isActive: true };
      const [rows, totalItems] = await Promise.all([
        prisma.ingredientCategoryL2.findMany({
          where,
          orderBy: { id: "asc" },
          skip,
          take: pageSize,
          include: { parent: true },
        }),
        prisma.ingredientCategoryL2.count({ where }),
      ]);
      const totalPages = Math.ceil(totalItems / pageSize);
      return paginated(rows, { page, pageSize, totalItems, totalPages });
    }

    // 默认返回树形结构，按一级分类分页（children 同步按启用状态过滤）。
    // 业务端启用-only 模式下，没有启用二级分类的一级分类对业务不可用，一并隐藏。
    const where = includeInactive
      ? {}
      : { isActive: true, children: { some: { isActive: true } } };
    const [l1, totalItems] = await Promise.all([
      prisma.ingredientCategoryL1.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
        include: {
          children: {
            orderBy: { id: "asc" },
            ...(includeInactive ? {} : { where: { isActive: true } }),
          },
        },
      }),
      prisma.ingredientCategoryL1.count({ where }),
    ]);
    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(l1, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取食材分类失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createIngredientCategorySchema, body);
    if (!validation.success) return validation.response;

    const { type, code, name, parentCode, description, isActive } = validation.data;

    if (type === "l1") {
      const existing = await prisma.ingredientCategoryL1.findUnique({ where: { code } });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL1.create({
        data: { code, name, description: description || null, isActive: isActive ?? true },
      });
      await logOperation(req, { action: "CREATE", entity: "IngredientCategoryL1", entityId: row.id, description: `创建: ${row.name || row.code}` });
      return NextResponse.json(row, { status: 201 });
    }
    if (type === "l2") {
      if (!parentCode?.trim()) {
        return NextResponse.json({ error: "所属一级分类编码不能为空" }, { status: 400 });
      }
      const existing = await prisma.ingredientCategoryL2.findUnique({ where: { code } });
      if (existing) {
        return NextResponse.json({ error: "编号已存在" }, { status: 400 });
      }
      const parent = await prisma.ingredientCategoryL1.findUnique({ where: { code: parentCode } });
      if (!parent) {
        return NextResponse.json({ error: "所属一级分类不存在" }, { status: 400 });
      }
      const row = await prisma.ingredientCategoryL2.create({
        data: { code, name, parentCode, description: description || null, isActive: isActive ?? true },
      });
      await logOperation(req, { action: "CREATE", entity: "IngredientCategoryL2", entityId: row.id, description: `创建: ${row.name || row.code}` });
      return NextResponse.json(row, { status: 201 });
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "编号已存在" }, { status: 400 });
    }
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
