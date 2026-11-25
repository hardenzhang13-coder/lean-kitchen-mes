-- 2026-11-25 调味品模块完整升级：原料/产物两层模型 + kind 边界 + 酱料业务剥离
--
-- 目的：
--   1. ingredients 新增 kind（food=食材 / seasoning=调味品），调味品独立于食材分类体系
--      （l2_code 置空、seasoning_type 列删除、SEA 分类树移除）；
--   2. standard_seasonings 升级为「调料产物」表（物理表名不变，外键零触碰）：
--      product_type（单品/复合/成品酱料）+ source_mode（转化/外购）+ 外购字段；
--   3. 存量回填：kind 按 SEA 子树判定；产物行 product_type='单品调料'、source_mode='transform'。
--
-- 前置盘点（2026-11-25 本地开发库只读查询）：
--   ingredients SEA 子树 8 行（SEA-SOL 4 / SEA-LIQ 4）；seasoning_type 全 NULL；
--   net_ingredients 无 SEA 引用；standard_seasonings 3 行（全部带 SEA l2_code）；
--   dish_seasoning_details 仅 1 行旧口径（type=seasoning, spec_id NULL）；
--   sauce_ingredients 5 / sauce_recipe_details 7 / dish_sauce_details 0（剥离确认）；
--   purchase_plans source_type：ingredient 17 / seasoning 8（历史快照保留）。
--   生产部署前须用同款只读查询复核（compose migrate deploy 之后）。
--
-- 幂等与重放：影子库从零重放时无种子数据，SEA 分类行可能不存在——
--   所有 UPDATE/DELETE 均以子查询或 WHERE 限定，空集时为空操作，不报错。
--
-- 回滚（按逆序手工执行，回滚前备份）：
--   重建 seasoning_type 列与 SEA 分类见 20261124170000/20261124130000 的 SQL；
--   kind 列 DROP；standard_seasonings 新列 DROP、source_ingredient_id/yield_rate/l2_code 恢复 NOT NULL；
--   被置 NULL 的 l2_code 无法自动还原（需备份）。

-- 1. ingredients.kind：先可空加列
ALTER TABLE `ingredients` ADD COLUMN `kind` VARCHAR(20) NULL;

-- 2. 回填边界：SEA 子树 或 已标 seasoning_type 的行 = 调味品
UPDATE `ingredients`
SET `kind` = 'seasoning'
WHERE `l2_code` IN (SELECT `code` FROM `ingredient_categories_l2` WHERE `parent_code` = 'SEA')
   OR `seasoning_type` IS NOT NULL;

UPDATE `ingredients` SET `kind` = 'food' WHERE `kind` IS NULL;

ALTER TABLE `ingredients` MODIFY COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'food';

-- CreateIndex
CREATE INDEX `ingredients_kind_idx` ON `ingredients`(`kind`);

-- 3. 调味品行脱离分类体系（l2_code 列先改可空再置空，与 schema 对齐）
ALTER TABLE `ingredients` MODIFY COLUMN `l2_code` VARCHAR(191) NULL;

UPDATE `ingredients` SET `l2_code` = NULL WHERE `kind` = 'seasoning';

-- 4. 删除 seasoning_type（产物类型归 standard_seasonings.product_type 表达）
ALTER TABLE `ingredients` DROP COLUMN `seasoning_type`;

-- 5. standard_seasonings 升级为调料产物表
-- 6a. 新列（先可空，回填后收紧）
ALTER TABLE `standard_seasonings` ADD COLUMN `product_type` VARCHAR(20) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `source_mode` VARCHAR(20) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `brand` VARCHAR(191) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `purchase_spec` VARCHAR(191) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `purchase_unit` VARCHAR(191) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `latest_ref_price` DECIMAL(10, 2) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `price_per_jin` DECIMAL(10, 4) NULL;
ALTER TABLE `standard_seasonings` ADD COLUMN `default_supplier_id` INTEGER NULL;

-- 6b. 存量回填：全部为转化口径单品调料（2026-11-25 盘点 3 行）
UPDATE `standard_seasonings` SET `product_type` = '单品调料' WHERE `product_type` IS NULL;
UPDATE `standard_seasonings` SET `source_mode` = 'transform' WHERE `source_mode` IS NULL;

ALTER TABLE `standard_seasonings` MODIFY COLUMN `product_type` VARCHAR(20) NOT NULL;
ALTER TABLE `standard_seasonings` MODIFY COLUMN `source_mode` VARCHAR(20) NOT NULL;

-- 6c. 转化口径来源/出成率改可空（外购口径无来源、无出成率）
ALTER TABLE `standard_seasonings` MODIFY COLUMN `source_ingredient_id` INTEGER NULL;
ALTER TABLE `standard_seasonings` MODIFY COLUMN `yield_rate` DECIMAL(5, 2) NULL;

-- 6c-2. 来源外键改 SET NULL（来源可空后，删除来源调味品不阻塞产物保留）
ALTER TABLE `standard_seasonings` DROP FOREIGN KEY `standard_seasonings_source_ingredient_id_fkey`;

ALTER TABLE `standard_seasonings`
ADD CONSTRAINT `standard_seasonings_source_ingredient_id_fkey`
FOREIGN KEY (`source_ingredient_id`) REFERENCES `ingredients`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- 6d. 产物脱离分类体系：SEA l2_code 先改可空置空，再整列删除（schema 已无该字段）
ALTER TABLE `standard_seasonings` MODIFY COLUMN `l2_code` VARCHAR(191) NULL;

UPDATE `standard_seasonings` SET `l2_code` = NULL
WHERE `l2_code` IN (SELECT `code` FROM `ingredient_categories_l2` WHERE `parent_code` = 'SEA');

DROP INDEX `standard_seasonings_l2_code_idx` ON `standard_seasonings`;

ALTER TABLE `standard_seasonings` DROP COLUMN `l2_code`;

-- 6e. 外购默认供应商外键（与 ingredients/sauce_ingredients 同口径）
ALTER TABLE `standard_seasonings`
ADD CONSTRAINT `standard_seasonings_default_supplier_id_fkey`
FOREIGN KEY (`default_supplier_id`) REFERENCES `suppliers`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. 移除 SEA 分类树（引用保护：被任一业务表引用的分类行不删。
--    此时 ingredients 的 SEA 引用已置空、standard_seasonings.l2_code 列已删除，正常全删）
DELETE FROM `ingredient_categories_l2`
WHERE `parent_code` = 'SEA'
  AND NOT EXISTS (SELECT 1 FROM `ingredients` i WHERE i.`l2_code` = `ingredient_categories_l2`.`code`)
  AND NOT EXISTS (SELECT 1 FROM `net_ingredients` n WHERE n.`l2_code` = `ingredient_categories_l2`.`code`);

DELETE FROM `ingredient_categories_l1`
WHERE `code` = 'SEA'
  AND NOT EXISTS (SELECT 1 FROM `ingredient_categories_l2` l2 WHERE l2.`parent_code` = 'SEA');
