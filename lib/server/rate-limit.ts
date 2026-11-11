const WINDOW_MS = 10 * 60 * 1000;
const USER_FAILURE_LIMIT = 5;
const USERNAME_FAILURE_LIMIT = 10;
const IP_ATTEMPT_LIMIT = 30;
const MAX_TRACKED_KEYS = 5000;

interface AttemptState {
  attempts: number[];
  failures: number[];
}

export interface LoginRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function recent(values: number[], now: number): number[] {
  return values.filter((value) => now - value < WINDOW_MS);
}

function retryAfter(values: number[], now: number): number {
  if (values.length === 0) return 0;
  return Math.max(1, Math.ceil((WINDOW_MS - (now - Math.min(...values))) / 1000));
}

export class LoginRateLimiter {
  private readonly byUserAndIp = new Map<string, AttemptState>();
  private readonly byIp = new Map<string, number[]>();
  private readonly byUsername = new Map<string, number[]>();

  consume(username: string, ip: string, now = Date.now()): LoginRateLimitResult {
    this.prune(now);
    const ipKey = ip || "unknown";
    const userKey = `${ipKey}|${normalizeUsername(username)}`;
    const userState = this.byUserAndIp.get(userKey) ?? { attempts: [], failures: [] };
    userState.attempts = recent(userState.attempts, now);
    userState.failures = recent(userState.failures, now);

    const ipAttempts = recent(this.byIp.get(ipKey) ?? [], now);
    const usernameFailures = recent(
      this.byUsername.get(normalizeUsername(username)) ?? [],
      now
    );
    const userBlocked = userState.failures.length >= USER_FAILURE_LIMIT;
    const usernameBlocked = usernameFailures.length >= USERNAME_FAILURE_LIMIT;
    const ipBlocked = ipAttempts.length >= IP_ATTEMPT_LIMIT;

    if (userBlocked || usernameBlocked || ipBlocked) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          userBlocked ? retryAfter(userState.failures, now) : 0,
          usernameBlocked ? retryAfter(usernameFailures, now) : 0,
          ipBlocked ? retryAfter(ipAttempts, now) : 0
        ),
      };
    }

    ipAttempts.push(now);
    this.byIp.set(ipKey, ipAttempts);
    userState.attempts.push(now);
    this.byUserAndIp.set(userKey, userState);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(username: string, ip: string, now = Date.now()): void {
    const userKey = `${ip || "unknown"}|${normalizeUsername(username)}`;
    const state = this.byUserAndIp.get(userKey) ?? { attempts: [], failures: [] };
    state.failures = recent([...state.failures, now], now);
    this.byUserAndIp.set(userKey, state);
    const normalized = normalizeUsername(username);
    this.byUsername.set(
      normalized,
      recent([...(this.byUsername.get(normalized) ?? []), now], now)
    );
  }

  reset(username: string, ip: string): void {
    const normalized = normalizeUsername(username);
    this.byUserAndIp.delete(`${ip || "unknown"}|${normalized}`);
    this.byUsername.delete(normalized);
  }

  private prune(now: number): void {
    if (
      this.byUserAndIp.size < MAX_TRACKED_KEYS &&
      this.byIp.size < MAX_TRACKED_KEYS &&
      this.byUsername.size < MAX_TRACKED_KEYS
    ) {
      return;
    }
    for (const [key, state] of this.byUserAndIp) {
      state.attempts = recent(state.attempts, now);
      state.failures = recent(state.failures, now);
      if (state.attempts.length === 0 && state.failures.length === 0) {
        this.byUserAndIp.delete(key);
      }
    }
    for (const [key, values] of this.byIp) {
      const kept = recent(values, now);
      if (kept.length === 0) this.byIp.delete(key);
      else this.byIp.set(key, kept);
    }
    for (const [key, values] of this.byUsername) {
      const kept = recent(values, now);
      if (kept.length === 0) this.byUsername.delete(key);
      else this.byUsername.set(key, kept);
    }
  }
}

export const loginRateLimiter = new LoginRateLimiter();
