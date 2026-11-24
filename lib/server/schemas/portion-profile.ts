import { z } from "zod";

// 注意：不声明 isBase 字段——单人份锁定标记仅由种子写入，zod 默认 strip 未知字段，
// 杜绝构造请求把普通行改成锁定行（锁定行在 API 层拒绝编辑/停用/删除）
export const createPortionProfileSchema = z.object({
  portion: z.string().trim().min(1, "份量不能为空").max(50, "份量最长 50 字符"),
  scenario: z.string().trim().min(1, "场景不能为空").max(50, "场景最长 50 字符"),
  multiplier: z
    .number({ message: "倍率须为数值" })
    .int("倍率须为整数")
    .positive("倍率须为正整数"),
  isActive: z.boolean().optional(),
});

export const updatePortionProfileSchema = createPortionProfileSchema.partial();
