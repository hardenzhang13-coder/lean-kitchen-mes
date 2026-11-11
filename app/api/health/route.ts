import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("health check timeout")), 5000);
      }),
    ]);
    return NextResponse.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logger.error({ err }, "health check failed");
    return NextResponse.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
