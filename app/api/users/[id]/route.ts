import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { getUserFromRequest, logOperation } from "@/lib/server/api-auth";
import { success } from "@/lib/server/api-response";
import { updateUserSchema } from "@/lib/server/schemas/auth";
import { validateBody } from "@/lib/server/validate";
import { isAdmin, ROLE_OPTIONS } from "@/lib/server/roles";

const publicFields = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const row = await prisma.user.findUnique({
    where: { id: Number(id), deletedAt: null },
    select: publicFields,
  });
  if (!row) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  return success(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const validation = validateBody(updateUserSchema, body);
  if (!validation.success) return validation.response;

  const { username, name, role, password, isActive } = validation.data;

  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  }
  if (role !== undefined && !ROLE_OPTIONS.some((r) => r.value === role)) {
    return NextResponse.json({ error: "无效的角色" }, { status: 400 });
  }
  if (Number(id) === user.userId && isActive === false) {
    return NextResponse.json({ error: "不能停用当前登录用户" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: Number(id), deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  if (username !== undefined && username.trim() !== existing.username) {
    const duplicate = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (duplicate) {
      return NextResponse.json({ error: "账号已存在" }, { status: 400 });
    }
  }

  const data: Prisma.UserUpdateInput = {};
  if (username !== undefined) data.username = username.trim();
  if (name !== undefined) data.name = name.trim();
  if (role !== undefined) data.role = role;
  if (password?.trim()) data.password = await bcrypt.hash(password.trim(), 10);
  if (isActive !== undefined) data.isActive = isActive;
  if (
    username !== undefined ||
    role !== undefined ||
    password?.trim() ||
    isActive !== undefined
  ) {
    data.sessionVersion = { increment: 1 };
  }

  const row = await prisma.user.update({
    where: { id: Number(id) },
    data,
    select: publicFields,
  });

  await logOperation(req, {
    action: "UPDATE",
    entity: "User",
    entityId: row.id,
    description: `更新用户: ${row.name} (${row.username})`,
  });

  return success(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const numericId = Number(id);

  if (numericId === user.userId) {
    return NextResponse.json({ error: "不能删除当前登录用户" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { id: numericId, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: numericId },
    data: {
      isActive: false,
      deletedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });

  await logOperation(req, {
    action: "DELETE",
    entity: "User",
    entityId: numericId,
    description: `停用用户: ${existing.name} (${existing.username})`,
  });

  return NextResponse.json({ success: true });
}
