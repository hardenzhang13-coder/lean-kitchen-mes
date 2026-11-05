-- AlterTable
-- scope 字段废弃：排程统一通过 store_id 关联门店；同时移除 store_id 的数据库默认值（应用层强制写入）
ALTER TABLE `schedules` DROP COLUMN `scope`,
    ALTER COLUMN `store_id` DROP DEFAULT;

-- AlterTable
-- code / updated_at 先以可空列加入，数据回填后再收紧为非空（兼容存量门店数据）
ALTER TABLE `stores` ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `manager` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `updated_at` DATETIME(3) NULL;

-- 数据回填：既有门店补编号（ST-0001 起按 id 顺序），updated_at 回退为创建时间
UPDATE `stores` SET `code` = CONCAT('ST-', LPAD(CAST(`id` AS CHAR), 4, '0')) WHERE `code` IS NULL OR `code` = '';
UPDATE `stores` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;

-- 收紧为非空并补唯一索引（与 Prisma schema 对齐）
ALTER TABLE `stores`
    MODIFY `code` VARCHAR(191) NOT NULL,
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `stores_code_key` ON `stores`(`code`);

-- CreateIndex
CREATE INDEX `stores_deleted_at_idx` ON `stores`(`deleted_at`);
