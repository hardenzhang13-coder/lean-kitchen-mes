import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

export const createUserSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(50),
  role: z.enum(["系统管理员", "业务运营", "厨师长", "采购"]),
});
