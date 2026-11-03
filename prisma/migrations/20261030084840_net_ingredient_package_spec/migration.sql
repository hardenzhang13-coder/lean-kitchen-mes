-- AlterTable
ALTER TABLE `net_ingredients` ADD COLUMN `package_spec` INTEGER NULL,
    ADD COLUMN `processing_fee_per_jin` DECIMAL(10, 2) NULL,
    MODIFY `unit` VARCHAR(191) NOT NULL DEFAULT 'g';

-- 存量净料单位迁移：500g → g（切配工单直接读 unit 展示）
UPDATE `net_ingredients` SET `unit` = 'g' WHERE `unit` = '500g';
