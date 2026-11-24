-- 2026-11-24 调味品类型字段独立 + 回退 SEA-ITM/COM/SAU 分类
--
-- 目的：单品调料/复合调料/成品酱料不占食材分类体系，改为 ingredients.seasoning_type 独立字段；
--       回退当天早些时候迁移 20261124130000 引入的 SEA-ITM/SEA-COM/SEA-SAU 三个二级分类。
-- 范围：ingredients 加可空列（无存量回填）；ingredient_categories_l2 删三行。
-- 前置盘点（2026-11-24 本地库只读查询）：无任何 ingredients.l2_code 引用这三个分类，删除安全。
-- 影响行数：ingredients 0 行变更（仅加列）；分类表 3 行（引用保护下正常全删）。
-- 回滚：ALTER TABLE ingredients DROP COLUMN seasoning_type;
--       分类行重插见 20261124130000 的 INSERT 语句。

ALTER TABLE `ingredients` ADD COLUMN `seasoning_type` VARCHAR(20) NULL;

-- 引用保护：仅删除未被任何食材引用的分类行（l2_code 为字符串引用，正常情况 3 行全删）
DELETE FROM `ingredient_categories_l2`
WHERE `code` IN ('SEA-ITM', 'SEA-COM', 'SEA-SAU')
  AND NOT EXISTS (
    SELECT 1 FROM `ingredients` i WHERE i.`l2_code` = `ingredient_categories_l2`.`code`
  );
