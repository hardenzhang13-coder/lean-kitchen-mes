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

  it("非法份量枚举值被拒绝", () => {
    const result = createNetIngredientSchema.safeParse({
      ...basePayload,
      portion: "超大份",
    });
    expect(result.success).toBe(false);
  });

  it("合法份量枚举值通过", () => {
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