-- 2026-11-25（复议）调味品类型回归原料层 + 产物表收敛为纯转化口径
--
-- 背景：当天上午 20261125110000 把「类型」放在产物上并引入外购建档口径；
-- 复议结论：类型是调味品的建档属性（新增调味品时选择），三个产物页签只是
-- 按类型过滤的视图；产物只能由「转化」生成，类型自动继承来源调味品，
-- 不需要产物类型/来源方式/来源调味品表单字段，规格指标去掉份量。
--
-- 内容：
--   1. ingredients 重新加回 seasoning_type（仅 kind=seasoning 使用，空 = 未设置）；
--   2. 按既有产物的 product_type 回填来源调味品类型（本地开发库 3 行产物 → 单品调料）；
--   3. standard_seasonings 收敛为纯转化口径：删除 source_mode 与外购字段组
--      （brand/purchase_spec/purchase_unit/latest_ref_price/price_per_jin/default_supplier_id）
--      及 portion（产物不再带份量口径）。
--
-- 影响面：外购口径从未部署生产（20261125110000 尚未 deploy），仅开发库可能存在
--   source_mode='purchase' 的试验行，随本迁移删除。
--
-- 回滚（按逆序手工执行，回滚前备份）：
--   被删列按 20261125110000 的 6a/6e 节重建并回填 source_mode='transform'；
--   ingredients.seasoning_type DROP；回填值无法自动还原（需备份）。

-- 1. 调味品类型回归原料层
ALTER TABLE `ingredients` ADD COLUMN `seasoning_type` VARCHAR(20) NULL;

-- 2. 按既有产物类型回填来源调味品（多产物类型不一致时取任一，业务上同来源应同类型）
UPDATE `ingredients` i
JOIN `standard_seasonings` sp
  ON sp.`source_ingredient_id` = i.`id` AND sp.`deleted_at` IS NULL
SET i.`seasoning_type` = sp.`product_type`
WHERE i.`kind` = 'seasoning' AND i.`seasoning_type` IS NULL;

-- 3. 产物表收敛为纯转化口径
-- 3a. 外购产物行随口径下线（生产无此数据；开发库试验行直接清除）
DELETE FROM `standard_seasonings` WHERE `source_mode` = 'purchase';

-- 3b. 删外购供应商外键与列
ALTER TABLE `standard_seasonings` DROP FOREIGN KEY `standard_seasonings_default_supplier_id_fkey`;

ALTER TABLE `standard_seasonings`
  DROP COLUMN `source_mode`,
  DROP COLUMN `brand`,
  DROP COLUMN `purchase_spec`,
  DROP COLUMN `purchase_unit`,
  DROP COLUMN `latest_ref_price`,
  DROP COLUMN `price_per_jin`,
  DROP COLUMN `default_supplier_id`,
  DROP COLUMN `portion`;
