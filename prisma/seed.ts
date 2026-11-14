import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL || "");
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
    { code: "SEA", name: "调味品" },
    { code: "MIN", name: "小料" },
    { code: "PIG", name: "猪肉类" },
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
    { code: "AQU-FIS", name: "鱼类", parentCode: "AQU", description: "" },
    { code: "AQU-SHR", name: "虾类", parentCode: "AQU", description: "" },
    { code: "AQU-SHE", name: "贝类", parentCode: "AQU", description: "" },
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
    // SEA-SEA「调料」已停用（保留编码兼容，服务端识别仍覆盖）；调料按物理形态分为固体/液体
    { code: "SEA-SOL", name: "固体类", parentCode: "SEA", description: "" },
    { code: "SEA-LIQ", name: "液体类", parentCode: "SEA", description: "" },
    { code: "MIN-GAR", name: "姜蒜类", parentCode: "MIN", description: "" },
    { code: "MIN-ONI", name: "葱香类", parentCode: "MIN", description: "" },
    { code: "MIN-PEP", name: "椒香类", parentCode: "MIN", description: "" },
    { code: "MIN-HER", name: "香料类", parentCode: "MIN", description: "" },
    { code: "MIN-OTH", name: "其他小料", parentCode: "MIN", description: "" },
    { code: "PIG-COL", name: "冷鲜", parentCode: "PIG", description: "" },
  ];
  await prisma.ingredientCategoryL2.createMany({ data: l2Categories, skipDuplicates: true });
  // SEA-SEA「调料」停用：保留编码兼容（服务端识别仍覆盖），业务端分类选择器不再显示
  await prisma.ingredientCategoryL2.updateMany({
    where: { code: "SEA-SEA" },
    data: { isActive: false },
  });

  // 4. 单位（重量类必须带 gramsPerUnit）
  //    只补缺失，不覆盖：运营在生产上调整过的换算系数（如「斤」改 490g）必须原样保留，
  //    否则每次部署都会被静默改回字典基线。仅当单位已存在但系数为空时才补齐。
  // 中英文别名均收录：规格文本里 g/kg 与 克/千克 同样常见，缺别名会导致换算中断
  const units = [
    { name: "斤", category: "weight", gramsPerUnit: 500 },
    { name: "公斤", category: "weight", gramsPerUnit: 1000 },
    { name: "千克", category: "weight", gramsPerUnit: 1000 },
    { name: "kg", category: "weight", gramsPerUnit: 1000 },
    { name: "克", category: "weight", gramsPerUnit: 1 },
    { name: "g", category: "weight", gramsPerUnit: 1 },
    { name: "两", category: "weight", gramsPerUnit: 50 },
    { name: "升", category: "volume", gramsPerUnit: null },
    { name: "毫升", category: "volume", gramsPerUnit: null },
    { name: "个", category: "count", gramsPerUnit: null },
    { name: "包", category: "count", gramsPerUnit: null },
    { name: "瓶", category: "count", gramsPerUnit: null },
    { name: "袋", category: "count", gramsPerUnit: null },
    { name: "箱", category: "count", gramsPerUnit: null },
    { name: "件", category: "count", gramsPerUnit: null },
    { name: "条", category: "count", gramsPerUnit: null },
    { name: "根", category: "count", gramsPerUnit: null },
    { name: "只", category: "count", gramsPerUnit: null },
    { name: "把", category: "count", gramsPerUnit: null },
  ];
  for (const u of units) {
    const existing = await prisma.unit.findUnique({ where: { name: u.name } });
    if (!existing) {
      await prisma.unit.create({ data: u });
      continue;
    }
    // 老库遗留：单位存在但换算系数为空时补齐；已有值一律以生产为准
    if (existing.gramsPerUnit == null && u.gramsPerUnit != null) {
      await prisma.unit.update({
        where: { name: u.name },
        data: { category: u.category, gramsPerUnit: u.gramsPerUnit },
      });
    }
  }

  // 5. 门店（工作台多门店切换；预置两家）
  const stores = [
    { code: "ST-0001", name: "新金食堂", isSystem: true },
    { code: "ST-0002", name: "明天吃啥首店", isSystem: true },
  ];
  for (const s of stores) {
    // 只在缺失时创建，不覆盖运营调整过的门店编码、系统标记与启用状态
    // （code 与 name 都有唯一约束，按两者任一命中即视为已存在）
    const existing = await prisma.store.findFirst({
      where: { OR: [{ name: s.name }, { code: s.code }] },
    });
    if (!existing) {
      await prisma.store.create({ data: s });
    }
  }

  // 6. 净菜包装基线：录入/转化净料时可直接选用
  //    只在缺失时创建；不复活运营主动停用或软删除的包装。
  const basePackaging = { name: "密封袋", size: "50cm×40cm" };
  const existingPackaging = await prisma.netPackaging.findUnique({
    where: { name_size: basePackaging },
  });
  if (!existingPackaging) {
    await prisma.netPackaging.create({ data: { ...basePackaging, isActive: true } });
  }

  // 7. 首次管理员：只在空库创建，绝不覆盖现网已有账号、密码或角色。
  const existingUserCount = await prisma.user.count({ where: { deletedAt: null } });
  if (existingUserCount === 0) {
    const username = process.env.INITIAL_ADMIN_USERNAME?.trim() || "admin";
    const password = process.env.INITIAL_ADMIN_PASSWORD?.trim();
    const name = process.env.INITIAL_ADMIN_NAME?.trim() || "管理员";
    if (!password || password.length < 10) {
      throw new Error("空库首次部署必须设置至少 10 位的 INITIAL_ADMIN_PASSWORD");
    }
    await prisma.user.create({
      data: {
        username,
        password: await bcrypt.hash(password, 10),
        name,
        role: "系统管理员",
      },
    });
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
