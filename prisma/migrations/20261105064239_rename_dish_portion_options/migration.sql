-- AlterTable
ALTER TABLE `dishes` MODIFY `portion` VARCHAR(191) NOT NULL DEFAULT '一锅10份';

-- 存量数据迁移：份量枚举值重命名
UPDATE `dishes` SET `portion` = '单人份' WHERE `portion` = '单人份量';
UPDATE `dishes` SET `portion` = '一锅10份' WHERE `portion` = '正餐份量';
