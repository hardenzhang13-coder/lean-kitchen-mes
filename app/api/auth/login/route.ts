import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/server/prisma";
import { createSession, setSessionCookie } from "@/lib/server/session";
import {
  success,
  unauthorized,
  internalError,
  tooManyRequests,
} from "@/lib/server/api-response";
import { loginSchema } from "@/lib/server/schemas/auth";
import { validateBody } from "@/lib/server/validate";
import { logger } from "@/lib/server/logger";
import { loginRateLimiter } from "@/lib/server/rate-limit";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.success) return validation.response;

    const { username, password } = validation.data;
    const ip = getClientIp(req);
    const rateLimit = loginRateLimiter.consume(username, ip);
    if (!rateLimit.allowed) {
      return tooManyRequests("登录尝试过于频繁，请稍后再试", rateLimit.retryAfterSeconds);
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive || user.deletedAt) {
      loginRateLimiter.recordFailure(username, ip);
      logger.warn({ username, ip }, "login failed");
      return unauthorized("用户名或密码错误");
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      loginRateLimiter.recordFailure(username, ip);
      logger.warn({ username, ip }, "login failed");
      return unauthorized("用户名或密码错误");
    }

    loginRateLimiter.reset(username, ip);
    const token = await createSession({
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    });
    await setSessionCookie(token);

    try {
      await prisma.operationLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          description: `登录: ${user.username}`,
          ip,
        },
      });
    } catch (err) {
      logger.error({ err }, "write login audit failed");
    }
    logger.info({ userId: user.id, ip }, "login succeeded");

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
