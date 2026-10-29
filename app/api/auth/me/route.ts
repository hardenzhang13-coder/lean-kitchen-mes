import { getCurrentUser } from "@/lib/server/session";
import { success, unauthorized } from "@/lib/server/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }
  return success({ user });
}
