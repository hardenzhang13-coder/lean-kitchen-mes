import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_SECRET } from "@/lib/server/env-check";
import { prisma } from "@/lib/server/prisma";

export interface SessionPayload {
  userId: number;
  username: string;
  name?: string | null;
  role?: string | null;
  sessionVersion: number;
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(SESSION_SECRET);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SESSION_SECRET, {
      clockTolerance: 60,
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("session")?.value;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  // secure 必须显式开启（FORCE_HTTPS=true），避免 HTTP 部署下浏览器丢弃 session
  const secure = process.env.FORCE_HTTPS === "true";
  cookieStore.set("session", token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: 60 * 30, // 30 minutes
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const token = await getSessionCookie();
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      isActive: true,
      sessionVersion: true,
      deletedAt: true,
    },
  });
  if (
    !user ||
    !user.isActive ||
    user.deletedAt ||
    user.sessionVersion !== payload.sessionVersion
  ) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  };
}
