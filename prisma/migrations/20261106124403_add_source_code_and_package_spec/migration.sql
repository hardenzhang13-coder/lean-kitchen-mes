-- AlterTable
ALTER TABLE `cutting_orders` ADD COLUMN `package_spec` INTEGER NULL,
    ADD COLUMN `source_code` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `purchase_plans` ADD COLUMN `source_code` VARCHAR(191) NULL;
