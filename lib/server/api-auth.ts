import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { logError } from "./logger";

/**
 * 从请求头中读取 proxy 注入的用户身份信息。
 *
 * 安全假设：此函数仅在已通过 proxy 认证的路由中调用。proxy 会验证 JWT、查询当前数据库
 * 账号状态和角色，并覆盖客户端传入的身份请求头，因此客户端无法伪造身份。
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
