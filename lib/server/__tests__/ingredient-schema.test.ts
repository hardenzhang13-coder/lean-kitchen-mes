import {
  createIngredientSchema,
  updateIngredientSchema,
} from "@/lib/server/schemas/ingredient";
import { createUnitSchema, updateUnitSchema } from "@/lib/server/schemas/unit";

// Zod 4 的 .partial() 会保留 .default()：若 update 基座带默认值，
// 部分更新缺省字段会被默认值静默覆盖（调味品被当成食材、停用单位被强制激活）。
describe("update schema 不得继承 create 侧默认值", () => {
  it("食材部分更新只回填传入字段", () => {
    const result = updateIngredientSchema.safeParse({ yieldRate: 80 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ yieldRate: 80 });
  });

  it("食材部分更新不注入 kind，避免调味品被误判为食材", () => {
    const result = updateIngredientSchema.safeParse({ name: "盐" });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("kind");
    expect(result.data).not.toHaveProperty("season");
    expect(result.data).not.toHaveProperty("storage");
  });

  it("创建食材仍带默认值", () => {
    const result = createIngredientSchema.safeParse({ name: "鸡" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "鸡",
      kind: "food",
      season: "四季",
      storage: "常温",
    });
  });

  it("单位部分更新不注入 isActive，避免停用单位被强制激活", () => {
    const result = updateUnitSchema.safeParse({ name: "克" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "克" });
  });

  it("创建单位仍带默认值", () => {
    const result = createUnitSchema.safeParse({ name: "克" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      name: "克",
      category: "other",
      isActive: true,
    });
  });
});
