import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, logOperation } from "@/lib/api-auth";
import { isAdmin, ROLE_OPTIONS } from "@/lib/roles";

const publicFields = {
  id: true,
  username: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const rows = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: publicFields,
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json();
  const { username, password, name, role } = body;

  if (!username?.trim() || !password?.trim() || !name?.trim() || !role) {
    return NextResponse.json({ error: "请填写所有必填字段" }, { status: 400 });
  }

  if (!ROLE_OPTIONS.some((r) => r.value === role)) {
    return NextResponse.json({ error: "无效的角色" }, { status: 400 });
  }

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
}
