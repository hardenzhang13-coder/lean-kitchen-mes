import "dotenv/config";
import { prisma } from "@/lib/prisma";

/**
 * 将 Ingredient 表中 l2Code = "GRA-SEA" 的旧兼容数据迁移到 SeasoningIngredient。
 * 迁移完成后，旧数据会被软删除（deletedAt）。
 */
async function main() {
  const oldIngredients = await prisma.ingredient.findMany({
    where: { l2Code: "GRA-SEA", deletedAt: null },
  });

  if (oldIngredients.length === 0) {
    console.log("没有需要迁移的 GRA-SEA 数据");
    return;
  }

  const last = await prisma.seasoningIngredient.findFirst({
    orderBy: { id: "desc" },
    select: { code: true },
  });
  let lastNum = last?.code
    ? parseInt(last.code.split("-")[1] || "0", 10)
    : 0;

  for (const ing of oldIngredients) {
    lastNum++;
    const code = `SEA-${String(lastNum).padStart(4, "0")}`;
    await prisma.seasoningIngredient.create({
      data: {
        code,
        name: ing.name,
        brand: ing.brand || ing.name,
        productSpec: ing.purchaseSpec,
        productUnit: ing.purchaseUnit,
        purchaseUnit: ing.purchaseUnit || "件",
        purchasePrice: Number(ing.latestRefPrice ?? 0),
        stockUnit: ing.stockUnit || ing.purchaseUnit || "件",
        latestRefPrice: ing.latestRefPrice,
        storage: ing.storage || "常温",
        l2Code: "SEA-SEA",
      },
    });
  }

  await prisma.ingredient.updateMany({
    where: { l2Code: "GRA-SEA" },
    data: { deletedAt: new Date() },
  });

  console.log(`迁移完成：${oldIngredients.length} 条记录`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
