import { cookies } from "next/headers";
import {
  createSession,
  verifySession,
  getSessionCookie,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
} from "../session";

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

const mockedCookies = cookies as jest.MockedFunction<typeof cookies>;

function createMockCookieStore(initial: { name: string; value: string }[] = []) {
  const store = new Map(initial.map((c) => [c.name, c.value]));
  return {
    get: jest.fn((name: string) => {
      const value = store.get(name);
      return value ? { name, value } : undefined;
    }),
    set: jest.fn((name: string, value: string, _options?: unknown) => {
      store.set(name, value);
    }),
    delete: jest.fn((name: string) => {
      store.delete(name);
    }),
  };
}

describe("session", () => {
  beforeEach(() => {
    mockedCookies.mockReset();
  });

  describe("createSession", () => {
    it("returns a non-empty JWT string", async () => {
      const token = await createSession({ userId: 1, username: "zhang" });
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      expect(token.split(".").length).toBe(3);
    });
  });

  describe("verifySession", () => {
    it("returns payload for a valid token", async () => {
      const payload = { userId: 1, username: "zhang", name: "Zhang", role: "admin" };
      const token = await createSession(payload);
      const verified = await verifySession(token);
      expect(verified).toMatchObject(payload);
    });

    it("returns null for an invalid token", async () => {
      const verified = await verifySession("invalid-token");
      expect(verified).toBeNull();
    });

    it("returns null for an empty string", async () => {
      const verified = await verifySession("");
      expect(verified).toBeNull();
    });
  });

  describe("getSessionCookie", () => {
    it("returns the session cookie value when present", async () => {
      const store = createMockCookieStore([{ name: "session", value: "token-123" }]);
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      const value = await getSessionCookie();
      expect(value).toBe("token-123");
      expect(store.get).toHaveBeenCalledWith("session");
    });

    it("returns undefined when session cookie is missing", async () => {
      const store = createMockCookieStore();
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      const value = await getSessionCookie();
      expect(value).toBeUndefined();
    });
  });

  describe("setSessionCookie", () => {
    it("sets the session cookie with httpOnly options", async () => {
      const store = createMockCookieStore();
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      await setSessionCookie("token-123");
      expect(store.set).toHaveBeenCalledWith("session", "token-123", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    });
  });

  describe("clearSessionCookie", () => {
    it("deletes the session cookie", async () => {
      const store = createMockCookieStore([{ name: "session", value: "token-123" }]);
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      await clearSessionCookie();
      expect(store.delete).toHaveBeenCalledWith("session");
    });
  });

  describe("getCurrentUser", () => {
    it("returns null when there is no session cookie", async () => {
      const store = createMockCookieStore();
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });

    it("returns payload for a valid session cookie", async () => {
      const payload = { userId: 2, username: "yang", role: "chef" };
      const token = await createSession(payload);
      const store = createMockCookieStore([{ name: "session", value: token }]);
      mockedCookies.mockReturnValue(store as unknown as ReturnType<typeof cookies>);

      const user = await getCurrentUser();
      expect(user).toMatchObject(payload);
    });
  });
});
