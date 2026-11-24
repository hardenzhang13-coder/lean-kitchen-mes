-- CreateTable
CREATE TABLE `portion_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `portion` VARCHAR(191) NOT NULL,
    `scenario` VARCHAR(191) NOT NULL,
    `multiplier` INTEGER NOT NULL,
    `is_base` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `portion_profiles_portion_key`(`portion`),
    INDEX `portion_profiles_scenario_sort_order_idx`(`scenario`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
