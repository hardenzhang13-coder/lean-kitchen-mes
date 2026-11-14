-- CreateTable
CREATE TABLE `net_packagings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `size` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `net_packagings_name_size_key`(`name`, `size`),
    INDEX `net_packagings_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 回填存量净料/小料使用的包装组合，保证历史档案可继续编辑
INSERT IGNORE INTO `net_packagings` (`name`, `size`, `is_active`, `created_at`, `updated_at`)
SELECT DISTINCT
    LEFT(TRIM(`package_material`), 50),
    LEFT(TRIM(`package_size`), 100),
    true,
    NOW(3),
    NOW(3)
FROM `net_ingredients`
WHERE `package_material` IS NOT NULL
  AND TRIM(`package_material`) <> ''
  AND `package_size` IS NOT NULL
  AND TRIM(`package_size`) <> '';

-- 空库或未使用默认包装时补一条默认选项
INSERT IGNORE INTO `net_packagings` (`name`, `size`, `is_active`, `created_at`, `updated_at`)
VALUES ('密封袋', '50cm×40cm', true, NOW(3), NOW(3));
