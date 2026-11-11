import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/server/prisma";
import { createSession, setSessionCookie } from "@/lib/server/session";
import { POST } from "../route";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    operationLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

jest.mock("@/lib/server/session", () => ({
  createSession: jest.fn(),
  setSessionCookie: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  operationLog: { create: jest.Mock };
};
const mockedBcryptCompare = bcrypt.compare as jest.Mock;
const mockedCreateSession = createSession as jest.Mock;
const mockedSetSessionCookie = setSessionCookie as jest.Mock;

function createLoginRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mockedPrisma.user.findUnique.mockReset();
    mockedPrisma.operationLog.create.mockReset();
    mockedBcryptCompare.mockReset();
    mockedCreateSession.mockReset();
    mockedSetSessionCookie.mockReset();
  });

  it("returns 400 when body is empty", async () => {
    const req = createLoginRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("username");
  });

  it("returns 400 when username is missing", async () => {
    const req = createLoginRequest({ password: "123456" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("username");
  });

  it("returns 401 when user does not exist", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const req = createLoginRequest({ username: "unknown", password: "123456" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("用户名或密码错误");
  });

  it("returns 401 when password is incorrect", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      username: "zhang",
      password: "hashed-password",
      name: "Zhang",
      role: "operator",
      isActive: true,
      sessionVersion: 2,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedBcryptCompare.mockResolvedValueOnce(false);

    const req = createLoginRequest({ username: "zhang", password: "wrong" });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("用户名或密码错误");
  });

  it("returns 429 after repeated failures for the same account", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 5; i += 1) {
      const res = await POST(
        createLoginRequest({ username: "bruteforce", password: "wrong-password" })
      );
      expect(res.status).toBe(401);
    }

    const blocked = await POST(
      createLoginRequest({ username: "bruteforce", password: "wrong-password" })
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 200 with user info on successful login", async () => {
    const user = {
      id: 1,
      username: "zhang",
      password: "hashed-password",
      name: "Zhang",
      role: "operator",
      isActive: true,
      sessionVersion: 2,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockedPrisma.user.findUnique.mockResolvedValueOnce(user);
    mockedBcryptCompare.mockResolvedValueOnce(true);
    mockedCreateSession.mockResolvedValueOnce("mock-token");

    const req = createLoginRequest({ username: "zhang", password: "123456" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user).toEqual({
      id: 1,
      username: "zhang",
      name: "Zhang",
      role: "operator",
    });

    expect(mockedCreateSession).toHaveBeenCalledWith({
      userId: 1,
      username: "zhang",
      name: "Zhang",
      role: "operator",
      sessionVersion: 2,
    });
    expect(mockedSetSessionCookie).toHaveBeenCalledWith("mock-token");
  });
});
