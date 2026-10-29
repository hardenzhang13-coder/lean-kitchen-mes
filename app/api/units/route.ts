import { NextRequest, NextResponse } from "next/server";
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
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.unit.findMany({
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.unit.count(),
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

    const { name, category } = validation.data;
    const row = await prisma.unit.create({
      data: { name, category: category || "other" },
    });
    await logOperation(req, { action: "CREATE", entity: "Unit", entityId: row.id, description: `创建: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
