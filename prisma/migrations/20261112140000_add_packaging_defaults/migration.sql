-- Backfill existing null or empty package values
UPDATE `net_ingredients`
SET `package_material` = '密封袋'
WHERE `package_material` IS NULL OR TRIM(`package_material`) = '';

UPDATE `net_ingredients`
SET `package_size` = '50cm×40cm'
WHERE `package_size` IS NULL OR TRIM(`package_size`) = '';

-- AlterTable
ALTER TABLE `net_ingredients`
    MODIFY `package_material` VARCHAR(191) NOT NULL DEFAULT '密封袋',
    MODIFY `package_size` VARCHAR(191) NOT NULL DEFAULT '50cm×40cm';
