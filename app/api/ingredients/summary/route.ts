import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server/api-auth";
import { getIngredientSummaryCounts } from "@/lib/server/ingredient-summary";
import { internalError } from "@/lib/server/api-response";

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const counts = await getIngredientSummaryCounts();
    return NextResponse.json({ success: true, data: counts });
  } catch {
    return internalError("获取食材统计失败");
  }
}
