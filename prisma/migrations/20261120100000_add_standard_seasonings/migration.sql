-- AlterTable
ALTER TABLE `dish_seasoning_details` ADD COLUMN `spec_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `standard_seasonings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `source_ingredient_id` INTEGER NOT NULL,
    `package_spec` INTEGER NOT NULL,
    `portion` VARCHAR(50) NULL,
    `yield_rate` DECIMAL(5, 2) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `processing_fee_per_jin` DECIMAL(10, 2) NULL,
    `gross_margin_rate` DECIMAL(5, 2) NULL,
    `l2_code` VARCHAR(191) NOT NULL,
    `storage` VARCHAR(191) NOT NULL DEFAULT '常温',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `standard_seasonings_code_key`(`code`),
    INDEX `standard_seasonings_source_ingredient_id_idx`(`source_ingredient_id`),
    INDEX `standard_seasonings_deleted_at_idx`(`deleted_at`),
    INDEX `standard_seasonings_l2_code_idx`(`l2_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `dish_seasoning_details_spec_id_idx` ON `dish_seasoning_details`(`spec_id`);

-- AddForeignKey
ALTER TABLE `dish_seasoning_details` ADD CONSTRAINT `dish_seasoning_details_spec_id_fkey` FOREIGN KEY (`spec_id`) REFERENCES `standard_seasonings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `standard_seasonings` ADD CONSTRAINT `standard_seasonings_source_ingredient_id_fkey` FOREIGN KEY (`source_ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
