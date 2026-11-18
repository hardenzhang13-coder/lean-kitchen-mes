-- 菜品类别改为可选：未分类菜品按 DSH-GEN-xxxx 生成编号
ALTER TABLE `dishes` MODIFY `category_id` INTEGER NULL;

-- 份量默认值随份量口径调整为小碗菜·10份
ALTER TABLE `dishes` MODIFY `portion` VARCHAR(191) NOT NULL DEFAULT '小碗菜·10份';

-- 可选关联的外键改为 ON DELETE SET NULL
ALTER TABLE `dishes` DROP FOREIGN KEY `dishes_category_id_fkey`;
DROP INDEX `dishes_category_id_fkey` ON `dishes`;
ALTER TABLE `dishes` ADD CONSTRAINT `dishes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `dish_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
