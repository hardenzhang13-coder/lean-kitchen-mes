import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/api-auth";
import { createSession, setSessionCookie } from "@/lib/session";

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { name, username, oldPassword, newPassword, confirmPassword } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
  }
  if (!oldPassword?.trim()) {
    return NextResponse.json({ error: "请输入旧密码" }, { status: 400 });
  }
  if (newPassword?.trim() && newPassword.trim() !== confirmPassword?.trim()) {
    return NextResponse.json({ error: "两次输入的新密码不一致" }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!current) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  const valid = await bcrypt.compare(oldPassword.trim(), current.password);
  if (!valid) {
    return NextResponse.json({ error: "旧密码错误" }, { status: 400 });
  }

  if (username?.trim() && username.trim() !== current.username) {
    const duplicate = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (duplicate) {
      return NextResponse.json({ error: "账号已存在" }, { status: 400 });
    }
  }

  const data: Prisma.UserUpdateInput = { name: name.trim() };
  const changedUsername = username?.trim() && username.trim() !== current.username;
  if (changedUsername) data.username = username.trim();
  if (newPassword?.trim()) data.password = await bcrypt.hash(newPassword.trim(), 10);

  const updated = await prisma.user.update({
    where: { id: user.userId },
    data,
  });

  if (changedUsername) {
    const token = await createSession({
      userId: updated.id,
      username: updated.username,
      name: updated.name,
      role: updated.role,
    });
    await setSessionCookie(token);
  }

  return NextResponse.json({
    success: true,
    needRelogin: changedUsername,
    user: {
      id: updated.id,
      username: updated.username,
      name: updated.name,
      role: updated.role,
    },
  });
}
