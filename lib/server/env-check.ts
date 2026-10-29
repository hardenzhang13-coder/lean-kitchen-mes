export const REQUIRED_ENV_VARS = {
  SESSION_SECRET: "JWT 签名密钥，用于 session cookie 签名验证",
  DATABASE_URL: "PostgreSQL 数据库连接字符串",
} as const;

export const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET!
);
