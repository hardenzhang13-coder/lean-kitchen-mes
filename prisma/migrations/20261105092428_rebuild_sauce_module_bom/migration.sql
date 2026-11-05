/*
  Warnings:

  - You are about to drop the column `recipe` on the `sauce_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `spec` on the `sauce_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `unit` on the `sauce_ingredients` table. All the data in the column will be lost.
  - You are about to drop the column `unit_price` on the `sauce_ingredients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sauce_ingredients` DROP COLUMN `recipe`,
    DROP COLUMN `spec`,
    DROP COLUMN `unit`,
    DROP COLUMN `unit_price`,
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `gross_margin_rate` DECIMAL(5, 2) NULL,
    ADD COLUMN `latest_ref_price` DECIMAL(10, 2) NULL,
    ADD COLUMN `price_per_jin` DECIMAL(10, 4) NULL,
    ADD COLUMN `purchase_spec` VARCHAR(191) NULL,
    ADD COLUMN `purchase_unit` VARCHAR(191) NULL,
    ADD COLUMN `remark` VARCHAR(191) NULL,
    ADD COLUMN `storage` VARCHAR(191) NOT NULL DEFAULT '常温',
    MODIFY `brand` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `sauce_recipe_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sauce_id` INTEGER NOT NULL,
    `line_type` VARCHAR(191) NOT NULL,
    `ref_id` INTEGER NOT NULL,
    `amount_g` DECIMAL(10, 2) NOT NULL,
    `cost` DECIMAL(10, 2) NULL,

    INDEX `sauce_recipe_details_ref_id_idx`(`ref_id`),
    UNIQUE INDEX `sauce_recipe_details_sauce_id_line_type_ref_id_key`(`sauce_id`, `line_type`, `ref_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sauce_processes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sauce_id` INTEGER NOT NULL,
    `step_no` INTEGER NOT NULL,
    `description` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sauce_recipe_details` ADD CONSTRAINT `sauce_recipe_details_sauce_id_fkey` FOREIGN KEY (`sauce_id`) REFERENCES `sauce_ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sauce_processes` ADD CONSTRAINT `sauce_processes_sauce_id_fkey` FOREIGN KEY (`sauce_id`) REFERENCES `sauce_ingredients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
