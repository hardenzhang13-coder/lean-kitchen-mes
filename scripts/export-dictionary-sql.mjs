/* 字典基线导出器：读取本地库字典表，生成幂等对齐 SQL（scripts/dictionary-baseline.sql）。
 *
 * 方案 B「字典即代码」：dictionary-baseline.sql 随仓库版本化，部署时由 deploy 流程
 * 灌入生产库（INSERT ... ON DUPLICATE KEY UPDATE），保证各环境字典一致。
 *
 * 覆盖范围（只增改、不删，不碰用户与业务数据）：
 * - units（计量单位，含 gramsPerUnit 换算系数）
 * - ingredient_categories_l1 / l2（食材一二级分类）
 * - dish_categories（菜品类别）
 *
 * 用法：node scripts/export-dictionary-sql.mjs
 * 本地库结构变更或字典调整后重跑本脚本并提交生成的 SQL。
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

/** SQL 字符串转义：单引号加倍 */
const q = (s) => `'` + String(s ?? "").replace(/'/g, "''") + `'`;

const lines = [];
lines.push("-- 字典基线（由 scripts/export-dictionary-sql.mjs 生成，勿手改）");
lines.push("-- 幂等对齐：INSERT ... ON DUPLICATE KEY UPDATE，只增改不删，不碰用户与业务数据");
lines.push("SET NAMES utf8mb4;");
lines.push("");

// 1. 计量单位（唯一键 name）
const units = await prisma.unit.findMany({ orderBy: { id: "asc" } });
lines.push("-- 计量单位");
for (const u of units) {
  lines.push(
    `INSERT INTO units (name, category, grams_per_unit, is_active) VALUES (${q(u.name)}, ${q(u.category)}, ${u.gramsPerUnit != null ? Number(u.gramsPerUnit) : "NULL"}, ${u.isActive ? 1 : 0}) ` +
      `ON DUPLICATE KEY UPDATE category = VALUES(category), grams_per_unit = VALUES(grams_per_unit), is_active = VALUES(is_active);`
  );
}
lines.push("");

// 2. 食材一级分类（唯一键 code）
const l1s = await prisma.ingredientCategoryL1.findMany({ orderBy: { id: "asc" } });
lines.push("-- 食材一级分类");
for (const c of l1s) {
  lines.push(
    `INSERT INTO ingredient_categories_l1 (code, name, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0}) ` +
      `ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = VALUES(is_active);`
  );
}
lines.push("");

// 3. 食材二级分类（唯一键 code；依赖一级已存在）
const l2s = await prisma.ingredientCategoryL2.findMany({ orderBy: { id: "asc" } });
lines.push("-- 食材二级分类");
for (const c of l2s) {
  lines.push(
    `INSERT INTO ingredient_categories_l2 (code, name, parent_code, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${q(c.parentCode)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0}) ` +
      `ON DUPLICATE KEY UPDATE name = VALUES(name), parent_code = VALUES(parent_code), description = VALUES(description), is_active = VALUES(is_active);`
  );
}
lines.push("");

// 4. 菜品类别（唯一键 code）
const dishCats = await prisma.dishCategory.findMany({ orderBy: { id: "asc" } });
lines.push("-- 菜品类别");
for (const c of dishCats) {
  lines.push(
    `INSERT INTO dish_categories (code, name, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0}) ` +
      `ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), is_active = VALUES(is_active);`
  );
}
lines.push("");

const out = "scripts/dictionary-baseline.sql";
writeFileSync(out, lines.join("\n"), "utf-8");
console.log(`已生成 ${out}`);
console.log(`  单位 ${units.length} / 食材一级 ${l1s.length} / 食材二级 ${l2s.length} / 菜品类别 ${dishCats.length}`);

await prisma.$disconnect();
