import { success } from "@/lib/server/api-response";
import { clearSessionCookie } from "@/lib/server/session";

export async function POST() {
  await clearSessionCookie();
  return success({ message: "已退出" });
}
