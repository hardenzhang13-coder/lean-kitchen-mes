import type { PrismaClient } from "@prisma/client";
import { resolveSelfProductionItems } from "../self-production-order-utils";

function createPrisma(
  nets: Array<{ id: number; name: string; packageSpec: number | null; l2Code: string }>,
  l2Rows: Array<{ code: string; parentCode: string | null }>
) {
  return {
    netIngredient: { findMany: jest.fn().mockResolvedValue(nets) },
    ingredientCategoryL2: { findMany: jest.fn().mockResolvedValue(l2Rows) },
  } as unknown as PrismaClient;
}

describe("resolveSelfProductionItems", () => {
  it("按二级分类 MIN 派生小料类型", async () => {
    const prisma = createPrisma(
      [
        { id: 1, name: "土豆丝", packageSpec: 500, l2Code: "VEG-LEF" },
        { id: 2, name: "蒜末", packageSpec: 100, l2Code: "MIN-GAR" },
      ],
      [
        { code: "VEG-LEF", parentCode: "VEG" },
        { code: "MIN-GAR", parentCode: "MIN" },
      ]
    );

    const resolved = await resolveSelfProductionItems(prisma, [
      { sourceId: 1, portions: 2 },
      { sourceId: 2, portions: 0.5 },
    ]);

    expect(resolved).toEqual([
      { sourceType: "net", sourceId: 1, portions: 2 },
      { sourceType: "minor", sourceId: 2, portions: 0.5 },
    ]);
  });

  it("缺少封装规格时拒绝", async () => {
    const prisma = createPrisma(
      [{ id: 1, name: "土豆丝", packageSpec: null, l2Code: "VEG-LEF" }],
      [{ code: "VEG-LEF", parentCode: "VEG" }]
    );

    await expect(
      resolveSelfProductionItems(prisma, [{ sourceId: 1, portions: 1 }])
    ).rejects.toThrow("缺少封装规格");
  });

  it("净料不存在时拒绝", async () => {
    const prisma = createPrisma([], []);

    await expect(
      resolveSelfProductionItems(prisma, [{ sourceId: 99, portions: 1 }])
    ).rejects.toThrow("存在无效的净料");
  });
});
