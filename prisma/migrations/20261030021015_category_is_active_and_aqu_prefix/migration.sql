-- AlterTable
ALTER TABLE `dish_categories` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `ingredient_categories_l1` ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `ingredient_categories_l2` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

-- 数据修正：水产(AQU) 下二级分类编号前缀 AUC → AQU（seed 源头写错，违反「L2 编号 = L1 前缀-后缀」约定）
-- l2.code 无外键反向引用，UPDATE 安全；业务表中的 l2_code 为字符串快照，同步更新
UPDATE `ingredient_categories_l2` SET `code` = 'AQU-FIS' WHERE `code` = 'AUC-FIS';
UPDATE `ingredient_categories_l2` SET `code` = 'AQU-SHR' WHERE `code` = 'AUC-SHR';
UPDATE `ingredient_categories_l2` SET `code` = 'AQU-SHE' WHERE `code` = 'AUC-SHE';

UPDATE `ingredients` SET `l2_code` = 'AQU-FIS' WHERE `l2_code` = 'AUC-FIS';
UPDATE `ingredients` SET `l2_code` = 'AQU-SHR' WHERE `l2_code` = 'AUC-SHR';
UPDATE `ingredients` SET `l2_code` = 'AQU-SHE' WHERE `l2_code` = 'AUC-SHE';

UPDATE `net_ingredients` SET `l2_code` = 'AQU-FIS' WHERE `l2_code` = 'AUC-FIS';
UPDATE `net_ingredients` SET `l2_code` = 'AQU-SHR' WHERE `l2_code` = 'AUC-SHR';
UPDATE `net_ingredients` SET `l2_code` = 'AQU-SHE' WHERE `l2_code` = 'AUC-SHE';

UPDATE `purchase_plans` SET `l2_code` = 'AQU-FIS' WHERE `l2_code` = 'AUC-FIS';
UPDATE `purchase_plans` SET `l2_code` = 'AQU-SHR' WHERE `l2_code` = 'AUC-SHR';
UPDATE `purchase_plans` SET `l2_code` = 'AQU-SHE' WHERE `l2_code` = 'AUC-SHE';

UPDATE `purchase_receipt_items` SET `l2_code` = 'AQU-FIS' WHERE `l2_code` = 'AUC-FIS';
UPDATE `purchase_receipt_items` SET `l2_code` = 'AQU-SHR' WHERE `l2_code` = 'AUC-SHR';
UPDATE `purchase_receipt_items` SET `l2_code` = 'AQU-SHE' WHERE `l2_code` = 'AUC-SHE';

UPDATE `cutting_orders` SET `l2_code` = 'AQU-FIS' WHERE `l2_code` = 'AUC-FIS';
UPDATE `cutting_orders` SET `l2_code` = 'AQU-SHR' WHERE `l2_code` = 'AUC-SHR';
UPDATE `cutting_orders` SET `l2_code` = 'AQU-SHE' WHERE `l2_code` = 'AUC-SHE';

