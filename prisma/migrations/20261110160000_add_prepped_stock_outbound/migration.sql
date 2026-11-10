-- CreateTable
CREATE TABLE `prepped_stock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `current_portions` DECIMAL(12, 2) NOT NULL,
    `current_qty` DECIMAL(14, 2) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prepped_stock_source_type_source_id_key`(`source_type`, `source_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prepped_stock_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `change_type` VARCHAR(191) NOT NULL,
    `change_portions` DECIMAL(12, 2) NOT NULL,
    `change_qty` DECIMAL(14, 2) NOT NULL,
    `balance_portions` DECIMAL(12, 2) NOT NULL,
    `balance_qty` DECIMAL(14, 2) NOT NULL,
    `biz_type` VARCHAR(191) NOT NULL,
    `biz_id` INTEGER NULL,
    `biz_ref_code` VARCHAR(191) NULL,
    `schedule_id` INTEGER NULL,
    `store_id` INTEGER NULL,
    `item_code` VARCHAR(191) NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `l1_name` VARCHAR(191) NULL,
    `l2_name` VARCHAR(191) NULL,
    `operator` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prepped_stock_ledger_source_type_source_id_idx`(`source_type`, `source_id`),
    INDEX `prepped_stock_ledger_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbound_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `schedule_id` INTEGER NOT NULL,
    `store_id` INTEGER NOT NULL,
    `schedule_code` VARCHAR(191) NULL,
    `schedule_title` VARCHAR(191) NOT NULL,
    `schedule_date` DATE NOT NULL,
    `total_portions` DECIMAL(12, 2) NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `as_planned` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'confirmed',
    `operator` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voided_at` DATETIME(3) NULL,
    `void_reason` VARCHAR(191) NULL,

    UNIQUE INDEX `outbound_orders_code_key`(`code`),
    INDEX `outbound_orders_store_id_idx`(`store_id`),
    INDEX `outbound_orders_status_idx`(`status`),
    INDEX `outbound_orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbound_order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `outbound_order_id` INTEGER NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `item_code` VARCHAR(191) NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `l1_name` VARCHAR(191) NULL,
    `l2_name` VARCHAR(191) NULL,
    `package_spec` INTEGER NULL,
    `required_portions` DECIMAL(12, 2) NOT NULL,
    `required_qty` DECIMAL(14, 2) NOT NULL,
    `available_portions` DECIMAL(12, 2) NOT NULL,
    `shipped_portions` DECIMAL(12, 2) NOT NULL,
    `shipped_qty` DECIMAL(14, 2) NOT NULL,
    `price_per_jin` DECIMAL(10, 2) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `prep_status` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `sort_index` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `outbound_orders` ADD CONSTRAINT `outbound_orders_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `outbound_order_items` ADD CONSTRAINT `outbound_order_items_outbound_order_id_fkey` FOREIGN KEY (`outbound_order_id`) REFERENCES `outbound_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
