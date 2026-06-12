import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "lean-kitchen-mes-secret-key-2026"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    if (token) {
      try {
        await jwtVerify(token, SECRET_KEY, { clockTolerance: 60 });
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
      const { payload } = await jwtVerify(token, SECRET_KEY, { clockTolerance: 60 });
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-user-id", String(payload.userId));
      requestHeaders.set("x-username", encodeURIComponent(String(payload.username || "")));
      requestHeaders.set("x-user-role", encodeURIComponent(String(payload.role || "")));
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, SECRET_KEY, { clockTolerance: 60 });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
