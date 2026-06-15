import { prisma } from "./prisma";
import { getCurrentUser } from "./session";
import { logError } from "./logger";

export async function getUser() {
  return getCurrentUser();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function logOperation({
  userId,
  action,
  entity,
  entityId,
  description,
  ip,
}: {
  userId: number;
  action: string;
  entity: string;
  entityId?: number | null;
  description?: string;
  ip?: string;
}) {
  try {
    await prisma.operationLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        description: description ?? null,
        ip: ip ?? null,
      },
    });
  } catch (e) {
    // 日志记录失败不应阻塞主流程
    logError(e, { context: "logOperation" });
  }
}
