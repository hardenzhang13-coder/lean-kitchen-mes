import { jwtVerify, SignJWT } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_SECRET } from "@/lib/server/env-check";

interface SessionTokenPayload {
  userId: number;
  username: string;
  name?: string | null;
  role?: string | null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    if (token) {
      try {
        await jwtVerify(token, SESSION_SECRET, { clockTolerance: 60 });
        return NextResponse.redirect(new URL("/", req.url));
      } catch {
        // invalid token, allow access to login
      }
    }
    return NextResponse.next();
  }

  // Auth API routes should bypass auth check
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // API routes should return 401 instead of redirect
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET, { clockTolerance: 60 });
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-user-id", String(payload.userId));
      requestHeaders.set("x-username", encodeURIComponent(String(payload.username || "")));
      requestHeaders.set("x-user-role", encodeURIComponent(String(payload.role || "")));
      const response = NextResponse.next({ request: { headers: requestHeaders } });

      // 滑动续期：剩余有效期不足 15 分钟时重新签发，避免持续作业的用户在登录满 30 分钟后被强制登出
      const remaining = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
      if (remaining < 15 * 60) {
        const session = payload as unknown as SessionTokenPayload;
        const renewed = await new SignJWT({
          userId: session.userId,
          username: session.username,
          name: session.name,
          role: session.role,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("30m")
          .sign(SESSION_SECRET);
        response.cookies.set("session", renewed, {
          httpOnly: true,
          secure: process.env.FORCE_HTTPS === "true",
          sameSite: "lax",
          maxAge: 60 * 30,
          path: "/",
        });
      }
      return response;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SESSION_SECRET, { clockTolerance: 60 });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
