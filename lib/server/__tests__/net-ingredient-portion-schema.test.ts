import {
  createNetIngredientSchema,
  updateNetIngredientSchema,
} from "@/lib/server/schemas/net-ingredient";

const basePayload = {
  name: "平包菜丝",
  sourceIngredientId: 1,
  packageSpec: 500,
  packageMaterial: "密封袋",
  packageSize: "50cm×40cm",
  yieldRate: 85,
  l2Code: "VEG-CAB",
};

describe("净料份量校验", () => {
  it("新建时份量必填", () => {
    const result = createNetIngredientSchema.safeParse(basePayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("portion"))).toBe(
        true
      );
    }
  });

  it("份量形态校验：非字符串/超长被拒绝（合法性由路由层查份量档案）", () => {
    expect(
      createNetIngredientSchema.safeParse({ ...basePayload, portion: 123 })
        .success
    ).toBe(false);
    expect(
      createNetIngredientSchema.safeParse({
        ...basePayload,
        portion: "份".repeat(51),
      }).success
    ).toBe(false);
  });

  it("合法份量标签通过形态校验", () => {
    const result = createNetIngredientSchema.safeParse({
      ...basePayload,
      portion: "社区·2份",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.portion).toBe("社区·2份");
    }
  });

  it("编辑时份量可缺省或显式清空", () => {
    expect(updateNetIngredientSchema.safeParse({}).success).toBe(true);
    expect(
      updateNetIngredientSchema.safeParse({ portion: null }).success
    ).toBe(true);
    expect(
      updateNetIngredientSchema.safeParse({ portion: "社区·4份" }).success
    ).toBe(true);
  });
});