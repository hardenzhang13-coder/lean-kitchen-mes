/* 一次性盘查脚本：菜品类别 / 食材分类 基础数据质量审计（不修改任何数据） */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

const report = { dishCategories: {}, ingredientCategories: {}, orphans: [] };

// 1. 菜品类别：总量、被菜品引用情况
const dishCats = await prisma.dishCategory.findMany({ orderBy: { id: "asc" } });
const dishUsage = await prisma.dish.groupBy({ by: ["categoryId"], _count: { _all: true } });
const usageMap = new Map(dishUsage.map((u) => [u.categoryId, u._count._all]));
report.dishCategories = {
  total: dishCats.length,
  used: dishCats.filter((c) => (usageMap.get(c.id) ?? 0) > 0).length,
  unused: dishCats.filter((c) => !(usageMap.get(c.id) ?? 0)).map((c) => `${c.code} ${c.name}`),
  list: dishCats.map((c) => ({ code: c.code, name: c.name, dishes: usageMap.get(c.id) ?? 0 })),
};

// 2. 食材分类：L1/L2 总量、L2 孤儿（父级不存在）
const l1 = await prisma.ingredientCategoryL1.findMany({ orderBy: { id: "asc" } });
const l2 = await prisma.ingredientCategoryL2.findMany({ orderBy: { id: "asc" } });
const l1Codes = new Set(l1.map((c) => c.code));
const l2Codes = new Set(l2.map((c) => c.code));
const orphanL2 = l2.filter((c) => !l1Codes.has(c.parentCode));
report.ingredientCategories = {
  l1Total: l1.length,
  l2Total: l2.length,
  emptyL1: l1
    .filter((c) => !l2.some((x) => x.parentCode === c.code))
    .map((c) => `${c.code} ${c.name}`),
  orphanL2: orphanL2.map((c) => `${c.code} ${c.name} (parent=${c.parentCode})`),
  l1List: l1.map((c) => ({
    code: c.code,
    name: c.name,
    children: l2.filter((x) => x.parentCode === c.code).map((x) => `${x.code} ${x.name}`),
  })),
};

// 3. 引用完整性：食材/净料的 l2Code 是否都在字典中
const [ingredients, netIngredients] = await Promise.all([
  prisma.ingredient.findMany({ where: { deletedAt: null }, select: { code: true, name: true, l2Code: true } }),
  prisma.netIngredient.findMany({ where: { deletedAt: null }, select: { code: true, name: true, l2Code: true } }),
]);
const badIng = ingredients.filter((i) => !l2Codes.has(i.l2Code));
const badNet = netIngredients.filter((i) => !l2Codes.has(i.l2Code));
report.orphans = [
  ...badIng.map((i) => `Ingredient ${i.code} ${i.name} l2Code=${i.l2Code}`),
  ...badNet.map((i) => `NetIngredient ${i.code} ${i.name} l2Code=${i.l2Code}`),
];

// 4. 历史单据中的 l2Code（快照数据，仅供参考）
const planL2 = await prisma.purchasePlan.findMany({ select: { l2Code: true }, distinct: ["l2Code"] });
const orderL2 = await prisma.cuttingOrder.findMany({ select: { l2Code: true }, distinct: ["l2Code"] });
const receiptL2 = await prisma.purchaseReceiptItem.findMany({ select: { l2Code: true }, distinct: ["l2Code"] });
const snapCodes = new Set(
  [...planL2, ...orderL2, ...receiptL2].map((r) => r.l2Code).filter(Boolean)
);
const snapshotOrphans = [...snapCodes].filter((c) => !l2Codes.has(c));

console.log(JSON.stringify({ ...report, snapshotOrphans }, null, 2));
await prisma.$disconnect();
