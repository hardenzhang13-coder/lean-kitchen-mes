-- AlterTable
ALTER TABLE `ingredient_categories_l1` ADD COLUMN `domain` VARCHAR(10) NOT NULL DEFAULT 'food';

-- AlterTable
ALTER TABLE `ingredient_categories_l2` ADD COLUMN `domain` VARCHAR(10) NOT NULL DEFAULT 'food';

-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `l3_code` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `net_ingredients` ADD COLUMN `l3_code` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ingredient_categories_l3` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parent_code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `domain` VARCHAR(10) NOT NULL DEFAULT 'food',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `ingredient_categories_l3_code_key`(`code`),
    INDEX `ingredient_categories_l3_parent_code_sort_order_idx`(`parent_code`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ingredient_categories_l3` ADD CONSTRAINT `ingredient_categories_l3_parent_code_fkey` FOREIGN KEY (`parent_code`) REFERENCES `ingredient_categories_l2`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

