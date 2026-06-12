import { NextRequest } from "next/server";
import { prisma } from "./prisma";

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
    console.error("Failed to log operation:", e);
  }
}
