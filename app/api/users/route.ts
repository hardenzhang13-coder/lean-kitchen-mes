import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, logOperation } from "@/lib/api-auth";
import { paginated, internalError } from "@/lib/api-response";
import { paginationQuerySchema } from "@/lib/schemas/common";
import { createUserSchema } from "@/lib/schemas/auth";
import { validateBody, validateQuery } from "@/lib/validate";
import { isAdmin } from "@/lib/roles";

const publicFields = {
  id: true,
  username: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const validation = validateQuery(paginationQuerySchema, searchParams);
    if (!validation.success) return validation.response;

    const { page, pageSize } = validation.data;
    const skip = (page - 1) * pageSize;

    const [rows, totalItems] = await Promise.all([
      prisma.user.findMany({
        orderBy: { id: "asc" },
        select: publicFields,
        skip,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);
    return paginated(rows, { page, pageSize, totalItems, totalPages });
  } catch {
    return internalError("获取用户失败");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user || !isAdmin(user.role)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateBody(createUserSchema, body);
    if (!validation.success) return validation.response;

    const { username, password, name, role } = validation.data;

    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) {
      return NextResponse.json({ error: "账号已存在" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password.trim(), 10);
    const row = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashed,
        name: name.trim(),
        role,
      },
      select: publicFields,
    });

    await logOperation(req, {
      action: "CREATE",
      entity: "User",
      entityId: row.id,
      description: `创建用户: ${row.name} (${row.username})`,
    });

    return NextResponse.json(row, { status: 201 });
  } catch {
    return internalError("创建用户失败");
  }
}
