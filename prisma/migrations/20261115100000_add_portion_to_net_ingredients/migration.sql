-- AlterTable
ALTER TABLE `net_ingredients` ADD COLUMN `portion` VARCHAR(50) NULL;

-- AlterTable
ALTER TABLE `dishes` MODIFY COLUMN `portion` VARCHAR(191) NOT NULL DEFAULT '小碗菜';

-- 存量菜品份量迁移到新枚举：单人份 = 1 小碗菜，一锅10份 = 10 小碗菜
UPDATE `dishes` SET `portion` = '小碗菜' WHERE `portion` = '单人份';
UPDATE `dishes` SET `portion` = '小碗菜·10份' WHERE `portion` = '一锅10份';