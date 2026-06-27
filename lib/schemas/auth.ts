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

export const updateUserSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  name: z.string().min(1).max(50).optional(),
  role: z.enum(["系统管理员", "业务运营", "厨师长", "采购"]).optional(),
  password: z.string().min(6).max(100).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(50),
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  oldPassword: z.string().min(1).max(100),
  newPassword: z.string().min(6).max(100).optional(),
  confirmPassword: z.string().min(6).max(100).optional(),
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, { message: "两次输入的新密码不一致", path: ["confirmPassword"] });
