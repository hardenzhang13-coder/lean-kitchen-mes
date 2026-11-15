-- AlterTable: 原料/调料补建档时间
ALTER TABLE `ingredients` ADD COLUMN `created_at` DATETIME(3) NULL DEFAULT NULL;

-- 存量原料/调料回填为初始建库日，与净料/小料/酱料现有 created_at 同口径
UPDATE `ingredients` SET `created_at` = '2026-10-26 11:32:10.000' WHERE `created_at` IS NULL;

-- AlterTable: 新建记录由数据库自动记录真实建档时间
ALTER TABLE `ingredients` MODIFY COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
