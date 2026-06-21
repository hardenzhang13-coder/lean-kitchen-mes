import { success } from "@/lib/api-response";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  await clearSessionCookie();
  return success({ message: "已退出" });
}
