import { prisma } from "@/lib/server/prisma";
import {
  countIngredientCategoryL1References,
  countIngredientCategoryL2TreeReferences,
  countIngredientCategoryL3References,
} from "../category-references";

jest.mock("@/lib/server/prisma", () => ({
  prisma: {
    ingredient: { count: jest.fn() },
    netIngredient: { count: jest.fn() },
    ingredientCategoryL2: { findMany: jest.fn() },
    ingredientCategoryL3: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  ingredient: { count: jest.Mock };
  netIngredient: { count: jest.Mock };
  ingredientCategoryL2: { findMany: jest.Mock };
  ingredientCategoryL3: { findMany: jest.Mock };
};

describe("category-references 三级分类引用统计", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.ingredient.count.mockResolvedValue(0);
    mockedPrisma.netIngredient.count.mockResolvedValue(0);
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([]);
    mockedPrisma.ingredientCategoryL3.findMany.mockResolvedValue([]);
  });

  it("L3 引用 = 食材 l3Code + 净料 l3Code（不含软删除）", async () => {
    mockedPrisma.ingredient.count.mockResolvedValue(2);
    mockedPrisma.netIngredient.count.mockResolvedValue(1);
    const result = await countIngredientCategoryL3References("VEG-LEF-SHQ");
    expect(result.total).toBe(3);
    expect(result.byEntity).toEqual({ 原料: 2, 净料: 1 });
    expect(mockedPrisma.ingredient.count).toHaveBeenCalledWith({
      where: { l3Code: "VEG-LEF-SHQ", deletedAt: null },
    });
  });

  it("L2 树引用 = L2 自身 + 全部 L3 子级合计", async () => {
    mockedPrisma.ingredientCategoryL3.findMany.mockResolvedValue([
      { code: "VEG-LEF-SHQ" },
      { code: "VEG-LEF-SC" },
    ]);
    // L2 自身 1 条；子级 SHQ 2 条；子级 SC 0 条
    mockedPrisma.ingredient.count.mockImplementation(
      async ({ where }: { where: { l2Code?: string; l3Code?: string } }) => {
        if (where.l2Code === "VEG-LEF") return 1;
        if (where.l3Code === "VEG-LEF-SHQ") return 2;
        return 0;
      }
    );
    const result = await countIngredientCategoryL2TreeReferences("VEG-LEF");
    expect(result.total).toBe(3);
    expect(result.byEntity).toEqual({ 原料: 3 });
  });

  it("L1 引用汇总其下所有二级（含三级子级）", async () => {
    mockedPrisma.ingredientCategoryL2.findMany.mockResolvedValue([
      { code: "VEG-LEF" },
    ]);
    mockedPrisma.ingredientCategoryL3.findMany.mockResolvedValue([
      { code: "VEG-LEF-SHQ" },
    ]);
    mockedPrisma.netIngredient.count.mockImplementation(
      async ({ where }: { where: { l2Code?: string; l3Code?: string } }) => {
        if (where.l2Code === "VEG-LEF") return 4;
        if (where.l3Code === "VEG-LEF-SHQ") return 1;
        return 0;
      }
    );
    const result = await countIngredientCategoryL1References("VEG");
    expect(result.total).toBe(5);
    expect(result.byEntity).toEqual({ 净料: 5 });
  });
});
