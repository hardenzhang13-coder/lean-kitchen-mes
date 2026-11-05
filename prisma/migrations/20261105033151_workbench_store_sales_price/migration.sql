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

-- 数据回填：存量排程 store_id 回填为 1，须先预置 id=1 的默认门店使外键校验通过。
-- 编号与系统标记由后续迁移 20261105040000 与 seed 补齐对齐，此处仅保证迁移可执行。
INSERT INTO `stores` (`id`, `name`, `created_at`) VALUES (1, '新金食堂', CURRENT_TIMESTAMP(3));

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
