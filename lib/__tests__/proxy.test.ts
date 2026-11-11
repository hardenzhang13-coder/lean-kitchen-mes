import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/server/prisma";
import { proxy } from "@/proxy";

jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
  SignJWT: jest.fn(),
}));

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;
const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
};

function mockVerifyResult(payload: Record<string, unknown>): Awaited<ReturnType<typeof jwtVerify>> {
  return {
    payload: {
      exp: Math.floor(Date.now() / 1000) + 30 * 60,
      ...payload,
    },
    protectedHeader: { alg: "HS256" },
    key: {} as CryptoKey,
  } as Awaited<ReturnType<typeof jwtVerify>>;
}

function createRequest(path: string, cookie?: string, method = "GET"): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  return new NextRequest(url, {
    method,
    headers: cookie ? new Headers({ cookie: `session=${cookie}` }) : undefined,
  });
}

function activeUser(role = "系统管理员") {
  return {
    id: 1,
    username: "admin",
    name: "管理员",
    role,
    isActive: true,
    sessionVersion: 1,
    deletedAt: null,
  };
}

describe("proxy", () => {
  beforeEach(() => {
    mockedJwtVerify.mockReset();
    mockedPrisma.user.findUnique.mockReset();
  });

  it("lets unauthenticated users open the login page", async () => {
    const res = await proxy(createRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("redirects authenticated users away from the login page", async () => {
    mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1, sessionVersion: 1 }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(activeUser());
    const res = await proxy(createRequest("/login", "valid-token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("bypasses authentication for auth APIs", async () => {
    const res = await proxy(createRequest("/api/auth/login"));
    expect(res.status).toBe(200);
  });

  it("leaves the health endpoint public", async () => {
    const res = await proxy(createRequest("/api/health"));
    expect(res.status).toBe(200);
  });

  it("returns 401 when a protected API has no token", async () => {
    const res = await proxy(createRequest("/api/schedules"));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("injects current database identity into API requests", async () => {
    mockedJwtVerify.mockResolvedValueOnce(
      mockVerifyResult({ userId: 1, role: "旧角色", sessionVersion: 1 })
    );
    mockedPrisma.user.findUnique.mockResolvedValueOnce(activeUser("系统管理员"));
    const res = await proxy(createRequest("/api/schedules", "valid-token"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-user-id");
    expect(res.headers.get("x-middleware-request-x-user-id")).toBe("1");
    expect(res.headers.get("x-middleware-request-x-user-role")).toBe(
      encodeURIComponent("系统管理员")
    );
  });

  it("invalidates a disabled user session", async () => {
    mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1, sessionVersion: 1 }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce({ ...activeUser(), isActive: false });
    const res = await proxy(createRequest("/api/schedules", "valid-token"));
    expect(res.status).toBe(401);
  });

  it("blocks purchase APIs during the trial", async () => {
    mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1, sessionVersion: 1 }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(activeUser());
    const res = await proxy(createRequest("/api/purchase-receipts", "valid-token"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("redirects purchase deep links to the unavailable-state page", async () => {
    mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 1, sessionVersion: 1 }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(activeUser());
    const res = await proxy(createRequest("/purchases/new", "valid-token"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/purchases");
  });

  it("prevents chefs from writing master data", async () => {
    mockedJwtVerify.mockResolvedValueOnce(mockVerifyResult({ userId: 2, sessionVersion: 1 }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(activeUser("厨师长"));
    const res = await proxy(createRequest("/api/dishes", "valid-token", "POST"));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FORBIDDEN");
  });
});
