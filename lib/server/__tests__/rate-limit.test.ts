import { LoginRateLimiter } from "../rate-limit";

describe("LoginRateLimiter", () => {
  it("blocks a username and IP pair after five failures", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;

    for (let i = 0; i < 5; i += 1) {
      expect(limiter.consume("zhang", "10.0.0.1", now + i).allowed).toBe(true);
      limiter.recordFailure("zhang", "10.0.0.1", now + i);
    }

    expect(limiter.consume("zhang", "10.0.0.1", now + 10).allowed).toBe(false);
  });

  it("does not block the same username on another IP", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      limiter.recordFailure("zhang", "10.0.0.1", now + i);
    }

    expect(limiter.consume("zhang", "10.0.0.2", now + 10).allowed).toBe(true);
  });

  it("blocks a username after failures are distributed across IPs", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 10; i += 1) {
      limiter.recordFailure("zhang", `10.0.0.${i}`, now + i);
    }

    expect(limiter.consume("zhang", "10.0.0.200", now + 11).allowed).toBe(false);
  });

  it("resets the pair after a successful login", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      limiter.recordFailure("zhang", "10.0.0.1", now + i);
    }
    limiter.reset("zhang", "10.0.0.1");

    expect(limiter.consume("zhang", "10.0.0.1", now + 10).allowed).toBe(true);
  });

  it("limits attempts from one IP across usernames", () => {
    const limiter = new LoginRateLimiter();
    const now = 1_000_000;
    for (let i = 0; i < 30; i += 1) {
      expect(limiter.consume(`user-${i}`, "10.0.0.1", now + i).allowed).toBe(true);
    }

    expect(limiter.consume("another", "10.0.0.1", now + 31).allowed).toBe(false);
  });
});
