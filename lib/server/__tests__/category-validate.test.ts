import { prisma } from "@/lib/server/prisma";
import { validateCategoryAssignment } from "../category-validate";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    ingredientCategoryL2: { findUnique: jest.fn() },
    ingredientCategoryL3: { findUnique: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  ingredientCategoryL2: { findUnique: jest.Mock };
  ingredientCategoryL3: { findUnique: jest.Mock };
};

describe("validateCategoryAssignment", () => {
  beforeEach(() => {
    mockedPrisma.ingredientCategoryL2.findUnique.mockReset();
    mockedPrisma.ingredientCategoryL3.findUnique.mockReset();
    mockedPrisma.ingredientCategoryL2.findUnique.mockResolvedValue({
      domain: "food",
    });
    mockedPrisma.ingredientCategoryL3.findUnique.mockResolvedValue({
      parentCode: "VEG-LEF",
      domain: "food",
    });
  });

  it("二级、三级均可空（调味品宽松口径）", async () => {
    const result = await validateCategoryAssignment(null, null, "seasoning");
    expect(result.ok).toBe(true);
    expect(mockedPrisma.ingredientCategoryL2.findUnique).not.toHaveBeenCalled();
  });

  it("三级非空但二级为空时拒绝", async () => {
    const result = await validateCategoryAssignment(null, "VEG-LEF-SHQ", "food");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("请先选择二级分类");
  });

  it("二级不存在时拒绝", async () => {
    mockedPrisma.ingredientCategoryL2.findUnique.mockResolvedValue(null);
    const result = await validateCategoryAssignment("BAD", null, "food");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("二级分类不存在");
  });

  it("二级 domain 与业务域不一致时拒绝", async () => {
    mockedPrisma.ingredientCategoryL2.findUnique.mockResolvedValue({
      domain: "seasoning",
    });
    const result = await validateCategoryAssignment("SEA-SPC", null, "food");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不属于食材分类体系");
  });

  it("三级不属于所选二级时拒绝", async () => {
    const result = await validateCategoryAssignment("VEG-ROT", "VEG-LEF-SHQ", "food");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不属于所选二级分类");
  });

  it("三级 domain 与业务域不一致时拒绝", async () => {
    mockedPrisma.ingredientCategoryL3.findUnique.mockResolvedValue({
      parentCode: "SEA-SPC",
      domain: "seasoning",
    });
    const result = await validateCategoryAssignment("VEG-LEF", "SEA-SPC-X", "food");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("不属于食材分类体系");
  });

  it("合法组合通过", async () => {
    const result = await validateCategoryAssignment("VEG-LEF", "VEG-LEF-SHQ", "food");
    expect(result.ok).toBe(true);
  });
});
