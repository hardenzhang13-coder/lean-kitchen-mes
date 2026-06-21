import { NextRequest, NextResponse } from "next/server";
import { checkDuplicateName } from "@/lib/duplicate-check";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const excludeId = searchParams.get("excludeId");

  if (!name || !name.trim()) {
    return NextResponse.json({ exists: false });
  }

  const result = await checkDuplicateName(name.trim(), {
    ...(excludeId && { excludeId: Number(excludeId) }),
  });

  return NextResponse.json(result);
}
