import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
});

export function logError(err: unknown, context?: Record<string, unknown>): void {
  if (err instanceof Error) {
    logger.error(
      { err: { message: err.message, stack: err.stack }, ...context },
      err.message
    );
  } else {
    logger.error({ err, ...context }, String(err));
  }
}
