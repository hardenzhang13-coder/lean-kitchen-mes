import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { logOperation } from "@/lib/server/api-auth";
import { paginated, internalError } from "@/lib/server/api-response";
import { paginationQuerySchema } from "@/lib/server/schemas/common";
import { createUnitSchema } from "@/lib/server/schemas/unit";
import { validateBody, validateQuery } from "@/lib/server/validate";
import { getErrorMessage } from "@/lib/shared/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    // 业务端默认只返回启用中的单位；设置页传 includeInactive=1 获取全量
    const includeInactive = searchParams.get("includeInactive") === "1";
    const where = includeInactive ? {} : { isActive: true };
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.unit.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取单位失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createUnitSchema, body);
    if (!validation.success) return validation.response;

    const { name, category, gramsPerUnit, isActive } = validation.data;
    if (category === "weight" && (gramsPerUnit == null || gramsPerUnit <= 0)) {
      return NextResponse.json(
        { error: "重量类单位必须填写换算克数（1 单位合多少克）" },
        { status: 400 }
      );
    }
    const row = await prisma.unit.create({
      data: {
        name,
        category,
        gramsPerUnit: gramsPerUnit ?? null,
        isActive: isActive ?? true,
      },
    });
    await logOperation(req, { action: "CREATE", entity: "Unit", entityId: row.id, description: `创建: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "单位名称已存在" }, { status: 400 });
    }
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
