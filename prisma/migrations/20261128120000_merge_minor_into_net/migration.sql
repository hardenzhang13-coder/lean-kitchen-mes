-- 小料并入净料（2026-11-28，原料分类体系升级线一）
-- 内容：dish_net_details 加 brand 列承接小料品牌；dish_minor_details 存量行迁入并 DROP；
--       role 历史中文值归一；prepped_stock / prepped_stock_batches 的 minor 行并入 net；
--       cutting_orders 的 minor 行归一为 net；MIN 分类带守卫清除。
-- 前置审计（生产只读盘点）：dish_minor_details 行数 / l2_code LIKE 'MIN-%' 引用 /
--       prepped_stock、prepped_stock_batches、cutting_orders source_type='minor' 行数 /
--       dish_net_details GROUP BY role。
-- 回滚：从迁移前 mysqldump 备份恢复 dish_minor_details、prepped_stock、prepped_stock_batches、
--       cutting_orders，DELETE FROM dish_net_details WHERE role='minor'，DROP COLUMN brand，
--       MIN 分类按旧 seed 重建。

-- 1. dish_net_details 承接小料品牌列
ALTER TABLE `dish_net_details` ADD COLUMN `brand` VARCHAR(191) NULL;

-- 2. 存量小料行并入 dish_net_details（role='minor'；spec 置 NULL，小料无规格文本）
INSERT INTO `dish_net_details` (`dish_id`, `role`, `net_ing_id`, `amount_g`, `spec`, `cost`, `brand`)
SELECT `dish_id`, 'minor', `net_ing_id`, `amount_g`, NULL, `cost`, `brand` FROM `dish_minor_details`;

-- 3. role 历史中文值归一（BOM 路由曾以中文「主料」兜底写入）
UPDATE `dish_net_details` SET `role` = 'main' WHERE `role` = '主料';
UPDATE `dish_net_details` SET `role` = 'support' WHERE `role` = '辅料';

-- 4. prepped_stock 的 minor 行并入 net：先并入已有 net 行，删除已合并行，孤儿行归一为 net
--    （source_id 本就指向 net_ingredients.id，归一后语义一致；生产预期 0 命中）
UPDATE `prepped_stock` n
JOIN `prepped_stock` m ON n.`source_id` = m.`source_id` AND n.`source_type` = 'net' AND m.`source_type` = 'minor'
SET n.`current_portions` = n.`current_portions` + m.`current_portions`,
    n.`current_qty` = n.`current_qty` + m.`current_qty`;
DELETE m FROM `prepped_stock` m
JOIN `prepped_stock` n ON n.`source_id` = m.`source_id` AND n.`source_type` = 'net'
WHERE m.`source_type` = 'minor';
UPDATE `prepped_stock` SET `source_type` = 'net' WHERE `source_type` = 'minor';
-- prepped_stock_ledger 历史 minor 流水保留（流水是历史事实，不迁移）

-- 4b. prepped_stock_batches 生产批次 minor 行并入 net（同 prepped_stock 口径；唯一键含 plan，按同批次合并）
UPDATE `prepped_stock_batches` n
JOIN `prepped_stock_batches` m ON n.`production_plan_id` = m.`production_plan_id` AND n.`source_id` = m.`source_id` AND n.`source_type` = 'net' AND m.`source_type` = 'minor'
SET n.`planned_portions` = n.`planned_portions` + m.`planned_portions`,
    n.`produced_portions` = n.`produced_portions` + m.`produced_portions`,
    n.`current_portions` = n.`current_portions` + m.`current_portions`,
    n.`current_qty` = n.`current_qty` + m.`current_qty`;
DELETE m FROM `prepped_stock_batches` m
JOIN `prepped_stock_batches` n ON n.`production_plan_id` = m.`production_plan_id` AND n.`source_id` = m.`source_id` AND n.`source_type` = 'net'
WHERE m.`source_type` = 'minor';
UPDATE `prepped_stock_batches` SET `source_type` = 'net' WHERE `source_type` = 'minor';

-- 4c. cutting_orders 切配工单 minor 行归一为 net（source_id 本就指向 net_ingredients.id；
--     不归一会导致完成生产回写与出库库存键 minor:id 查不到已合并的 net 库存）
UPDATE `cutting_orders` SET `source_type` = 'net' WHERE `source_type` = 'minor';
-- outbound_order_items / self_production_items 历史 minor 值保留（历史单据快照；
-- 作废回滚经 applyStockChange 入口归一为 net，不会重建 minor 库存行）

-- 5. MIN 分类清除（带引用守卫：仍有业务引用的行不删，由部署后审计兜底报警）
DELETE FROM `ingredient_categories_l2`
WHERE `parent_code` = 'MIN'
  AND NOT EXISTS (SELECT 1 FROM `net_ingredients` WHERE `l2_code` = `ingredient_categories_l2`.`code`)
  AND NOT EXISTS (SELECT 1 FROM `ingredients` WHERE `l2_code` = `ingredient_categories_l2`.`code`);
DELETE FROM `ingredient_categories_l1`
WHERE `code` = 'MIN'
  AND NOT EXISTS (SELECT 1 FROM `ingredient_categories_l2` WHERE `parent_code` = 'MIN');

-- 6. 废弃小料明细表
ALTER TABLE `dish_minor_details` DROP FOREIGN KEY `dish_minor_details_dish_id_fkey`;
ALTER TABLE `dish_minor_details` DROP FOREIGN KEY `dish_minor_details_net_ing_id_fkey`;
DROP TABLE `dish_minor_details`;
