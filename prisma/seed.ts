import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. 菜品类别
  const dishCategories = [
    { code: "PORK", name: "猪肉类", description: "" },
    { code: "BEEF", name: "牛肉类", description: "" },
    { code: "MUTTON", name: "羊肉类", description: "" },
    { code: "CHICKEN", name: "鸡肉类", description: "" },
    { code: "DUCK", name: "鸭肉类", description: "" },
    { code: "EGG", name: "蛋品类", description: "" },
    { code: "PERCH", name: "鲈鱼类", description: "" },
    { code: "GRASS", name: "草鱼类", description: "" },
    { code: "CRUCIAN", name: "鲫鱼类", description: "" },
    { code: "WUCHANG", name: "武昌鱼类", description: "" },
    { code: "BLACK", name: "黑鱼类", description: "" },
    { code: "HAIRTAIL", name: "带鱼类", description: "" },
    { code: "YELLOW", name: "黄鱼类", description: "" },
    { code: "SHRIMP", name: "虾类", description: "" },
    { code: "SPECIAL", name: "特色菜", description: "" },
    { code: "TOFU", name: "豆制品", description: "" },
    { code: "MUSHROOM", name: "菌菇类", description: "" },
    { code: "VEGETABLE", name: "蔬菜类", description: "" },
    { code: "SOUP", name: "汤类", description: "" },
  ];
  await prisma.dishCategory.createMany({ data: dishCategories, skipDuplicates: true });

  // 2. 食材一级分类
  const l1Categories = [
    { code: "VEG", name: "蔬菜" },
    { code: "MEA", name: "畜肉" },
    { code: "POU", name: "禽蛋" },
    { code: "AQU", name: "水产" },
    { code: "DRY", name: "干货" },
    { code: "BEA", name: "豆制品" },
    { code: "PRC", name: "加工制品" },
    { code: "GRA", name: "米面粮油" },
  ];
  await prisma.ingredientCategoryL1.createMany({ data: l1Categories, skipDuplicates: true });

  // 3. 食材二级分类
  const l2Categories = [
    { code: "VEG-LEF", name: "叶菜", parentCode: "VEG", description: "" },
    { code: "VEG-ROT", name: "根茎菜", parentCode: "VEG", description: "" },
    { code: "VEG-FRU", name: "瓜果菜", parentCode: "VEG", description: "" },
    { code: "VEG-BEA", name: "豆类蔬菜", parentCode: "VEG", description: "" },
    { code: "VEG-MUS", name: "菌菇", parentCode: "VEG", description: "" },
    { code: "MEA-POR", name: "猪肉", parentCode: "MEA", description: "" },
    { code: "MEA-BEE", name: "牛肉", parentCode: "MEA", description: "" },
    { code: "MEA-MUT", name: "羊肉", parentCode: "MEA", description: "" },
    { code: "POU-CHI", name: "鸡肉", parentCode: "POU", description: "" },
    { code: "POU-DUC", name: "鸭肉", parentCode: "POU", description: "" },
    { code: "POU-EGG", name: "蛋类", parentCode: "POU", description: "" },
    { code: "AUC-FIS", name: "鱼类", parentCode: "AQU", description: "" },
    { code: "AUC-SHR", name: "虾类", parentCode: "AQU", description: "" },
    { code: "AUC-SHE", name: "贝类", parentCode: "AQU", description: "" },
    { code: "DRY-MUS", name: "菌菇干货", parentCode: "DRY", description: "" },
    { code: "DRY-SEA", name: "海味干货", parentCode: "DRY", description: "" },
    { code: "DRY-MIS", name: "杂项干货", parentCode: "DRY", description: "" },
    { code: "BEA-TOFU", name: "豆腐", parentCode: "BEA", description: "" },
    { code: "BEA-SOY", name: "豆制品", parentCode: "BEA", description: "" },
    { code: "PRC-SAU", name: "酱腌菜", parentCode: "PRC", description: "" },
    { code: "PRC-FRO", name: "速冻食品", parentCode: "PRC", description: "" },
    { code: "GRA-RIC", name: "米", parentCode: "GRA", description: "" },
    { code: "GRA-FLO", name: "面", parentCode: "GRA", description: "" },
    { code: "GRA-OIL", name: "油", parentCode: "GRA", description: "" },
    { code: "GRA-SEA", name: "调味品", parentCode: "GRA", description: "" },
  ];
  await prisma.ingredientCategoryL2.createMany({ data: l2Categories, skipDuplicates: true });

  // 4. 单位
  const units = [
    { name: "斤", category: "weight" },
    { name: "公斤", category: "weight" },
    { name: "克", category: "weight" },
    { name: "升", category: "volume" },
    { name: "毫升", category: "volume" },
    { name: "个", category: "count" },
    { name: "包", category: "count" },
    { name: "瓶", category: "count" },
    { name: "袋", category: "count" },
    { name: "箱", category: "count" },
    { name: "件", category: "count" },
    { name: "条", category: "count" },
    { name: "根", category: "count" },
    { name: "只", category: "count" },
    { name: "把", category: "count" },
  ];
  await prisma.unit.createMany({ data: units, skipDuplicates: true });

  // 5. 用户
  const users = [
    { username: "zhang", password: "123456", name: "张" },
    { username: "yang", password: "123456", name: "杨" },
  ];
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (!existing) {
      await prisma.user.create({
        data: {
          username: u.username,
          password: await bcrypt.hash(u.password, 10),
          name: u.name,
        },
      });
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
