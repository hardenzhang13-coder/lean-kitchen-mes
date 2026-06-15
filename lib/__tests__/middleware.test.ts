import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { middleware } from "@/middleware";

jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

function mockVerifyResult(payload: Record<string, unknown>): Awaited<ReturnType<typeof jwtVerify>> {
  return {
    payload,
    protectedHeader: { alg: "HS256" },
    key: {} as CryptoKey,
  } as Awaited<ReturnType<typeof jwtVerify>>;
}

function createRequest(path: string, cookie?: string): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  return new NextRequest(url, {
    headers: cookie ? new Headers({ cookie: `session=${cookie}` }) : undefined,
  });
}

describe("middleware", () => {
  beforeEach(() => {
    mockedJwtVerify.mockReset();
  });

  describe("login page", () => {
    it("lets unauthenticated users through", async () => {
      const req = createRequest("/login");
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it("redirects authenticated users to home", async () => {
      mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1 }));
      const req = createRequest("/login", "valid-token");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("lets users through when token is invalid", async () => {
      mockedJwtVerify.mockRejectedValueOnce(new Error("invalid"));
      const req = createRequest("/login", "invalid-token");
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe("auth API routes", () => {
    it("bypasses authentication for /api/auth/*", async () => {
      const req = createRequest("/api/auth/login");
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });

  describe("protected API routes", () => {
    it("returns 401 when no token is provided", async () => {
      const req = createRequest("/api/schedules");
      const res = await middleware(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 for an invalid token", async () => {
      mockedJwtVerify.mockRejectedValueOnce(new Error("invalid"));
      const req = createRequest("/api/schedules", "invalid-token");
      const res = await middleware(req);
      expect(res.status).toBe(401);
    });

    it("injects user headers for a valid token", async () => {
      mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1, username: "zhang", role: "admin" }));
      const req = createRequest("/api/schedules", "valid-token");
      const res = await middleware(req);
      expect(res.status).toBe(200);
      // Next.js encodes rewritten request headers as response headers prefixed with x-middleware-request-*.
      expect(res.headers.get("x-middleware-override-headers")).toContain("x-user-id");
      expect(res.headers.get("x-middleware-request-x-user-id")).toBe("1");
      expect(res.headers.get("x-middleware-request-x-username")).toBe("zhang");
      expect(res.headers.get("x-middleware-request-x-user-role")).toBe("admin");
    });
  });

  describe("protected pages", () => {
    it("redirects to login when no token is provided", async () => {
      const req = createRequest("/schedules");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("allows access with a valid token", async () => {
      mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1 }));
      const req = createRequest("/schedules", "valid-token");
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });

    it("redirects to login for an invalid token", async () => {
      mockedJwtVerify.mockRejectedValueOnce(new Error("invalid"));
      const req = createRequest("/schedules", "invalid-token");
      const res = await middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    });
  });
});
