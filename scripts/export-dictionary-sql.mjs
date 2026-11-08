/* 字典基线导出器：读取本地库字典表，生成初始化 SQL（scripts/dictionary-baseline.sql）。
 *
 * 方案 B「字典即代码」：dictionary-baseline.sql 随仓库版本化，部署时由 deploy 流程
 * 灌入生产库（INSERT IGNORE），仅为新环境补初始字典，绝不覆盖已有记录。
 *
 * ⚠️ 历史教训：曾用 ON DUPLICATE KEY UPDATE 做"对齐"，每次部署都会把生产环境的
 * 分类改名/停用/单位换算系数改回仓库旧值（2026-11-08 生产事故）。如需向已有环境
 * 推送字典变更，请走显式迁移或人工操作，禁止在本文件恢复 upsert。
 *
 * 覆盖范围（只增、不改、不删，不碰用户与业务数据）：
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
lines.push("-- 纯初始化：INSERT IGNORE，已存在的记录一律跳过——生产环境的字典修改（改名/停用/换算系数）不会被部署覆盖");
lines.push("SET NAMES utf8mb4;");
lines.push("");

// 1. 计量单位（唯一键 name）
const units = await prisma.unit.findMany({ orderBy: { id: "asc" } });
lines.push("-- 计量单位");
for (const u of units) {
  lines.push(
    `INSERT IGNORE INTO units (name, category, grams_per_unit, is_active) VALUES (${q(u.name)}, ${q(u.category)}, ${u.gramsPerUnit != null ? Number(u.gramsPerUnit) : "NULL"}, ${u.isActive ? 1 : 0});`
  );
}
lines.push("");

// 2. 食材一级分类（唯一键 code）
const l1s = await prisma.ingredientCategoryL1.findMany({ orderBy: { id: "asc" } });
lines.push("-- 食材一级分类");
for (const c of l1s) {
  lines.push(
    `INSERT IGNORE INTO ingredient_categories_l1 (code, name, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0});`
  );
}
lines.push("");

// 3. 食材二级分类（唯一键 code；依赖一级已存在）
const l2s = await prisma.ingredientCategoryL2.findMany({ orderBy: { id: "asc" } });
lines.push("-- 食材二级分类");
for (const c of l2s) {
  lines.push(
    `INSERT IGNORE INTO ingredient_categories_l2 (code, name, parent_code, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${q(c.parentCode)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0});`
  );
}
lines.push("");

// 4. 菜品类别（唯一键 code）
const dishCats = await prisma.dishCategory.findMany({ orderBy: { id: "asc" } });
lines.push("-- 菜品类别");
for (const c of dishCats) {
  lines.push(
    `INSERT IGNORE INTO dish_categories (code, name, description, is_active) VALUES (${q(c.code)}, ${q(c.name)}, ${c.description != null ? q(c.description) : "NULL"}, ${c.isActive ? 1 : 0});`
  );
}
lines.push("");

// 5. 门店（唯一键 name；预置两家，只增不改）
const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });
lines.push("-- 门店");
for (const s of stores) {
  lines.push(`INSERT IGNORE INTO stores (code, name, created_at, updated_at) VALUES (${q(s.code)}, ${q(s.name)}, NOW(3), NOW(3))`);
}
lines.push("");

const out = "scripts/dictionary-baseline.sql";
writeFileSync(out, lines.join("\n"), "utf-8");
console.log(`已生成 ${out}`);
console.log(`  单位 ${units.length} / 食材一级 ${l1s.length} / 食材二级 ${l2s.length} / 菜品类别 ${dishCats.length}`);

await prisma.$disconnect();
