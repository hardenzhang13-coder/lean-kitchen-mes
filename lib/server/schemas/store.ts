import { z } from "zod";
import { paginationQuerySchema } from "./common";

export const createStoreSchema = z.object({
  name: z.string().min(1, "门店名称不能为空").max(50, "门店名称不能超过 50 字"),
  manager: z.string().max(50).nullish(),
  phone: z.string().max(20).nullish(),
  address: z.string().max(200).nullish(),
  // 场景打通份量档案 portion_profiles.scenario，必填，取值合法性由路由层查表
  scenario: z.string().trim().min(1, "请选择场景").max(50),
});

export const updateStoreSchema = z.object({
  name: z.string().min(1, "门店名称不能为空").max(50, "门店名称不能超过 50 字").optional(),
  manager: z.string().max(50).nullish(),
  phone: z.string().max(20).nullish(),
  address: z.string().max(200).nullish(),
  // 必填口径下不允许清空；省略 = 保持不变
  scenario: z.string().trim().min(1, "请选择场景").max(50).optional(),
  isActive: z.boolean().optional(),
});

export const storeQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(100).optional(),
  /** 仅返回启用中的门店（排程下拉等场景） */
  activeOnly: z.enum(["1", "true"]).optional(),
});
