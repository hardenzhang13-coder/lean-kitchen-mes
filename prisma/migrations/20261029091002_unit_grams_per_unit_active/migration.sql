-- AlterTable
ALTER TABLE `units` ADD COLUMN `grams_per_unit` DECIMAL(10, 2) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;
