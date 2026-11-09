-- AlterTable
ALTER TABLE `schedule_items` ADD COLUMN `sold_recorded_at` DATETIME(3) NULL,
    ADD COLUMN `sold_recorded_by` VARCHAR(191) NULL;