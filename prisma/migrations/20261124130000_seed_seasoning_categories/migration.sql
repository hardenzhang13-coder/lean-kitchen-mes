-- 2026-11-24 调味品模块升级：SEA 下新增三个二级分类（单品调料/复合调料/成品酱料）
--
-- 目的：本地开发库已跑过旧种子，新增分类不会自动补入；本迁移与 prisma/seed.ts 同步，
--       保证本地库与生产部署（seed 仅缺失时创建）后的分类一致。
-- 范围：仅向 ingredient_categories_l2 插入三行；不动既有分类、不动业务表。
-- 幂等：逐行 NOT EXISTS 判断，可重复执行。
-- 影响行数：0（若种子/迁移已建）或 3。
-- 回滚：DELETE FROM ingredient_categories_l2 WHERE code IN ('SEA-ITM','SEA-COM','SEA-SAU');
--       注意：若有调味品已选用这些分类（l2Code 字符串引用），删除后分类名展示兜底为编码，
--       故回滚前须确认无引用或先迁移引用。
-- 说明：ingredient_categories_l2 无 created_at/updated_at 列（schema 未定义），插默认值即可。
-- 说明：影子库从零重放迁移时没有种子数据，SEA 一级分类可能不存在（种子负责建 L1）；
--       用 INSERT IGNORE 依赖外键静默跳过即可，幂等且与生产（seed 建 L1 + seed/migration 补 L2）兼容。

INSERT IGNORE INTO ingredient_categories_l2 (code, name, parent_code, description, is_active, sort_order)
SELECT 'SEA-ITM', '单品调料', 'SEA', '', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM ingredient_categories_l2 WHERE code = 'SEA-ITM');

INSERT IGNORE INTO ingredient_categories_l2 (code, name, parent_code, description, is_active, sort_order)
SELECT 'SEA-COM', '复合调料', 'SEA', '', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM ingredient_categories_l2 WHERE code = 'SEA-COM');

INSERT IGNORE INTO ingredient_categories_l2 (code, name, parent_code, description, is_active, sort_order)
SELECT 'SEA-SAU', '成品酱料', 'SEA', '', 1, 0
WHERE NOT EXISTS (SELECT 1 FROM ingredient_categories_l2 WHERE code = 'SEA-SAU');
