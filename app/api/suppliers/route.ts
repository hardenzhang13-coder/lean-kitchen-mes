import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation } from "@/lib/api-auth";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { createSupplierSchema } from "@/lib/schemas/supplier";
import { validateBody, validateQuery } from "@/lib/validate";
import { getErrorMessage } from "@/lib/error-utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.supplier.findMany({
        orderBy: { id: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.supplier.count(),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取供应商失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(createSupplierSchema, body);
    if (!validation.success) return validation.response;

    const { name, contact, phone, remark } = validation.data;
    const row = await prisma.supplier.create({
      data: { name, contact: contact || null, phone: phone || null, remark: remark || null },
    });
    await logOperation(req, { action: "CREATE", entity: "Supplier", entityId: row.id, description: `创建: ${row.name}` });
    return NextResponse.json(row, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 400 });
  }
}
