import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { logError } from "./logger";

/**
 * 从请求头中读取 middleware 注入的用户身份信息。
 *
 * 安全假设：此函数仅在已通过 middleware 认证的路由中调用。middleware 会验证 JWT token，
 * 无效时直接返回 401，不会将请求转发到下游 API 路由；同时 middleware 会覆盖客户端传入的
 * x-user-id / x-username / x-user-role 请求头。因此客户端无法伪造这些 header 绕过认证。
 */
export function getUserFromRequest(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  const username = req.headers.get("x-username");
  const role = req.headers.get("x-user-role");
  if (!userId || !username) return null;
  return {
    userId: Number(userId),
    username: decodeURIComponent(username),
    role: role ? decodeURIComponent(role) : null,
  };
}

export async function logOperation(
  req: NextRequest,
  {
    action,
    entity,
    entityId,
    description,
  }: {
    action: string;
    entity: string;
    entityId?: number;
    description?: string;
  }
) {
  const user = getUserFromRequest(req);
  if (!user) return;
  try {
    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        action,
        entity,
        entityId: entityId ?? null,
        description: description ?? null,
        ip: req.headers.get("x-forwarded-for") ?? null,
      },
    });
  } catch (e) {
    logError(e, { context: "logOperation" });
  }
}
