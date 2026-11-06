-- AlterTable
ALTER TABLE `dish_categories` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ingredient_categories_l1` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ingredient_categories_l2` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- 数据回填：存量数据按 id 顺序初始化排序值，保持现有展示顺序不变
UPDATE `dish_categories` SET `sort_order` = `id` WHERE `sort_order` = 0;
UPDATE `ingredient_categories_l1` SET `sort_order` = `id` WHERE `sort_order` = 0;
UPDATE `ingredient_categories_l2` SET `sort_order` = `id` WHERE `sort_order` = 0;

-- CreateIndex
CREATE INDEX `ingredient_categories_l2_parent_code_sort_order_idx` ON `ingredient_categories_l2`(`parent_code`, `sort_order`);
