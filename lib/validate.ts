import { z, ZodError } from "zod";
import { badRequest } from "./api-response";

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; response: ReturnType<typeof badRequest> } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (e) {
    if (e instanceof ZodError) {
      const messages = e.issues
        .map((err) => `${err.path.join(".") || "root"}: ${err.message}`)
        .join("; ");
      return { success: false, response: badRequest(`输入校验失败: ${messages}`) };
    }
    throw e;
  }
}

export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; response: ReturnType<typeof badRequest> } {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (obj[key] !== undefined) {
      if (Array.isArray(obj[key])) {
        (obj[key] as string[]).push(value);
      } else {
        obj[key] = [obj[key], value];
      }
    } else {
      obj[key] = value;
    }
  }

  try {
    const data = schema.parse(obj);
    return { success: true, data };
  } catch (e) {
    if (e instanceof ZodError) {
      const messages = e.issues
        .map((err) => `${err.path.join(".") || "root"}: ${err.message}`)
        .join("; ");
      return { success: false, response: badRequest(`查询参数校验失败: ${messages}`) };
    }
    throw e;
  }
}
