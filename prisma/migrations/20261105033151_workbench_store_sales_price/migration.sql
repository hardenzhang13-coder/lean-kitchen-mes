-- AlterTable
ALTER TABLE `dishes` ADD COLUMN `price` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `schedule_items` ADD COLUMN `actual_sold_qty` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `schedules` ADD COLUMN `store_id` INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE `stores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stores_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
