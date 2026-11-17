-- CreateTable
CREATE TABLE `self_production_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `produce_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '待生效',
    `operator` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `self_production_orders_code_key`(`code`),
    INDEX `self_production_orders_produce_date_status_idx`(`produce_date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `self_production_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `portions` DECIMAL(12, 2) NOT NULL,

    UNIQUE INDEX `self_production_items_order_id_source_id_key`(`order_id`, `source_id`),
    INDEX `self_production_items_source_id_idx`(`source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_self_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `self_order_id` INTEGER NOT NULL,

    UNIQUE INDEX `production_plan_self_orders_plan_id_self_order_id_key`(`plan_id`, `self_order_id`),
    INDEX `production_plan_self_orders_self_order_id_idx`(`self_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `self_production_items` ADD CONSTRAINT `self_production_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `self_production_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plan_self_orders` ADD CONSTRAINT `production_plan_self_orders_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plan_self_orders` ADD CONSTRAINT `production_plan_self_orders_self_order_id_fkey` FOREIGN KEY (`self_order_id`) REFERENCES `self_production_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
