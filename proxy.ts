import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_SECRET } from "@/lib/server/env-check";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { canAccessApi, canAccessPage } from "@/lib/shared/access-control";
import { TRIAL_FEATURES } from "@/lib/shared/features";

interface SessionTokenPayload {
  userId: number;
  username: string;
  name?: string | null;
  role?: string | null;
  sessionVersion: number;
  exp?: number;
}

interface CurrentUser {
  id: number;
  username: string;
  name: string | null;
  role: string | null;
  sessionVersion: number;
}

type SessionResult =
  | { status: "ok"; user: CurrentUser; renewedToken?: string }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.FORCE_HTTPS === "true",
    sameSite: "lax" as const,
    maxAge: 60 * 30,
    path: "/",
  };
}

function jsonError(message: string, code: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

function finalize(
  response: NextResponse,
  result: Extract<SessionResult, { status: "ok" }>
): NextResponse {
  if (result.renewedToken) {
    response.cookies.set("session", result.renewedToken, cookieOptions());
  }
  return response;
}

async function resolveSession(req: NextRequest): Promise<SessionResult> {
  const token = req.cookies.get("session")?.value;
  if (!token) return { status: "unauthenticated" };

  let payload: SessionTokenPayload;
  try {
    const verified = await jwtVerify(token, SESSION_SECRET, { clockTolerance: 60 });
    payload = verified.payload as unknown as SessionTokenPayload;
  } catch {
    return { status: "unauthenticated" };
  }

  if (!payload.userId || !payload.sessionVersion) {
    return { status: "unauthenticated" };
  }

  try {
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
      return { status: "unauthenticated" };
    }

    const current: CurrentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };

    let renewedToken: string | undefined;
    const remaining = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
    if (remaining < 15 * 60) {
      renewedToken = await new SignJWT({
        userId: current.id,
        username: current.username,
        name: current.name,
        role: current.role,
        sessionVersion: current.sessionVersion,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30m")
        .sign(SESSION_SECRET);
    }

    return { status: "ok", user: current, renewedToken };
  } catch (err) {
    logger.error({ err }, "proxy session lookup failed");
    return { status: "unavailable" };
  }
}

function requestWithIdentity(req: NextRequest, user: CurrentUser): Headers {
  const headers = new Headers(req.headers);
  headers.set("x-user-id", String(user.id));
  headers.set("x-username", encodeURIComponent(user.username));
  headers.set("x-user-role", encodeURIComponent(user.role ?? ""));
  headers.set("x-user-session-version", String(user.sessionVersion));
  return headers;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  const result = await resolveSession(req);

  if (isLoginPage) {
    if (result.status === "ok") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (result.status === "unavailable") {
    return jsonError("认证服务暂时不可用", "AUTH_SERVICE_UNAVAILABLE", 503);
  }

  if (result.status === "unauthenticated") {
    const response = pathname.startsWith("/api/")
      ? jsonError("Unauthorized", "UNAUTHORIZED", 401)
      : NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("session");
    return response;
  }

  const { user } = result;
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase());

  if (
    !TRIAL_FEATURES.purchases &&
    (pathname.startsWith("/api/purchase-") || pathname === "/api/upload")
  ) {
    return finalize(
      jsonError("采购功能在试运行期间暂未开放", "FEATURE_NOT_AVAILABLE", 403),
      result
    );
  }

  if (pathname.startsWith("/api/")) {
    if (!canAccessApi(pathname, req.method, user.role) || (isWrite && !user.role)) {
      return finalize(jsonError("无权限", "FORBIDDEN", 403), result);
    }
    return finalize(
      NextResponse.next({ request: { headers: requestWithIdentity(req, user) } }),
      result
    );
  }

  if (!canAccessPage(pathname, user.role)) {
    return finalize(NextResponse.rewrite(new URL("/forbidden", req.url)), result);
  }

  if (!TRIAL_FEATURES.purchases && pathname.startsWith("/purchases/")) {
    return finalize(NextResponse.rewrite(new URL("/purchases", req.url)), result);
  }

  return finalize(
    NextResponse.next({ request: { headers: requestWithIdentity(req, user) } }),
    result
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
