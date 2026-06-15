import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, setSessionCookie } from "@/lib/session";
import { success, unauthorized, internalError } from "@/lib/api-response";
import { loginSchema } from "@/lib/schemas/auth";
import { validateBody } from "@/lib/validate";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.success) return validation.response;

    const { username, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return unauthorized("用户名或密码错误");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return unauthorized("用户名或密码错误");
    }

    const token = await createSession({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
    await setSessionCookie(token);

    return success({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    logger.error({ err }, "POST /api/auth/login failed");
    return internalError("登录失败，请稍后重试");
  }
}
