-- CreateTable
CREATE TABLE `dish_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `dish_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredient_categories_l1` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ingredient_categories_l1_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredient_categories_l2` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parent_code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `ingredient_categories_l2_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `units_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ingredients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NULL,
    `l2_code` VARCHAR(191) NOT NULL,
    `purchase_spec` VARCHAR(191) NULL,
    `purchase_unit` VARCHAR(191) NULL,
    `stock_unit` VARCHAR(191) NULL,
    `latest_ref_price` DECIMAL(10, 2) NULL,
    `season` VARCHAR(191) NOT NULL DEFAULT '四季',
    `storage` VARCHAR(191) NOT NULL DEFAULT '常温',
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `ingredients_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `net_ingredients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `source_ingredient_id` INTEGER NULL,
    `spec` VARCHAR(191) NULL,
    `yield_rate` DECIMAL(5, 2) NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT '500g',
    `l2_code` VARCHAR(191) NOT NULL,
    `storage` VARCHAR(191) NOT NULL DEFAULT '冷藏',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `net_ingredients_code_key`(`code`),
    INDEX `net_ingredients_source_ingredient_id_idx`(`source_ingredient_id`),
    INDEX `net_ingredients_deleted_at_idx`(`deleted_at`),
    INDEX `net_ingredients_l2_code_idx`(`l2_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sauce_ingredients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `spec` VARCHAR(191) NULL,
    `recipe` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'g',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sauce_ingredients_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dish_minor_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dish_id` INTEGER NOT NULL,
    `net_ing_id` INTEGER NOT NULL,
    `amount_g` DECIMAL(10, 2) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `cost` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dishes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `intro` VARCHAR(191) NULL,
    `category_id` INTEGER NOT NULL,
    `cuisine` VARCHAR(191) NULL,
    `technique` VARCHAR(191) NULL,
    `taste` VARCHAR(191) NULL,
    `portion` VARCHAR(191) NOT NULL DEFAULT '正餐份量',
    `season` VARCHAR(191) NOT NULL DEFAULT '四季',
    `meat_type` VARCHAR(191) NULL,
    `cost` DECIMAL(10, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `operator` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dishes_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dish_net_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dish_id` INTEGER NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `net_ing_id` INTEGER NOT NULL,
    `amount_g` DECIMAL(10, 2) NOT NULL,
    `spec` VARCHAR(191) NULL,
    `cost` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dish_seasoning_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dish_id` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `amount_g` DECIMAL(10, 2) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `cost` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dish_sauce_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dish_id` INTEGER NOT NULL,
    `sauce_id` INTEGER NOT NULL,
    `amount_g` DECIMAL(10, 2) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `cost` DECIMAL(10, 2) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dish_processes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dish_id` INTEGER NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `step_no` INTEGER NOT NULL,
    `object` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `tool` VARCHAR(191) NULL,
    `standard` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `schedule_date` DATE NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT '全部食堂',
    `status` VARCHAR(191) NOT NULL DEFAULT '待生效',
    `operator` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NOT NULL,
    `dish_id` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `l2_code` VARCHAR(191) NULL,
    `gross_need` DECIMAL(10, 2) NOT NULL,
    `stock_deducted` DECIMAL(10, 2) NOT NULL,
    `suggested_purchase` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `purchase_spec` VARCHAR(191) NULL,
    `price_unit` VARCHAR(191) NULL,
    `actual_purchase` DECIMAL(10, 2) NULL,
    `actual_amount` DECIMAL(10, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cutting_orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `l1_code` VARCHAR(191) NULL,
    `l2_code` VARCHAR(191) NULL,
    `spec` VARCHAR(191) NULL,
    `required_qty` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `actual_qty` DECIMAL(10, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_receipts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_date` DATE NOT NULL,
    `supplier_id` INTEGER NULL,
    `supplier_name` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `operator` VARCHAR(191) NULL,
    `image_url` VARCHAR(191) NULL,
    `purchasing_unit` VARCHAR(191) NOT NULL DEFAULT '切配中心',
    `image_hash` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '待结算',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reimbursement_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_receipt_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `ingredient_id` INTEGER NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `l2_code` VARCHAR(191) NULL,
    `l2_name` VARCHAR(191) NULL,
    `is_manual` BOOLEAN NOT NULL DEFAULT false,
    `spec` VARCHAR(191) NULL,
    `qty` DECIMAL(10, 2) NOT NULL,
    `price_unit` VARCHAR(191) NOT NULL,
    `purchase_unit` VARCHAR(191) NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `stock_unit` VARCHAR(191) NOT NULL,
    `stock_in_qty` DECIMAL(10, 2) NOT NULL,
    `storage` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ingredient_id` INTEGER NULL,
    `current_qty` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_ingredient_id_key`(`ingredient_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_ledger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ingredient_id` INTEGER NULL,
    `change_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `change_type` VARCHAR(191) NOT NULL,
    `change_qty` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `settlement_status` VARCHAR(191) NOT NULL DEFAULT '待结算',
    `operator` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_reimbursements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `operator` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entity_id` INTEGER NULL,
    `description` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ingredient_categories_l2` ADD CONSTRAINT `ingredient_categories_l2_parent_code_fkey` FOREIGN KEY (`parent_code`) REFERENCES `ingredient_categories_l1`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `net_ingredients` ADD CONSTRAINT `net_ingredients_source_ingredient_id_fkey` FOREIGN KEY (`source_ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_minor_details` ADD CONSTRAINT `dish_minor_details_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_minor_details` ADD CONSTRAINT `dish_minor_details_net_ing_id_fkey` FOREIGN KEY (`net_ing_id`) REFERENCES `net_ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dishes` ADD CONSTRAINT `dishes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `dish_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_net_details` ADD CONSTRAINT `dish_net_details_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_net_details` ADD CONSTRAINT `dish_net_details_net_ing_id_fkey` FOREIGN KEY (`net_ing_id`) REFERENCES `net_ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_seasoning_details` ADD CONSTRAINT `dish_seasoning_details_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_sauce_details` ADD CONSTRAINT `dish_sauce_details_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_sauce_details` ADD CONSTRAINT `dish_sauce_details_sauce_id_fkey` FOREIGN KEY (`sauce_id`) REFERENCES `sauce_ingredients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dish_processes` ADD CONSTRAINT `dish_processes_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_dish_id_fkey` FOREIGN KEY (`dish_id`) REFERENCES `dishes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_items` ADD CONSTRAINT `schedule_items_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_plans` ADD CONSTRAINT `purchase_plans_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cutting_orders` ADD CONSTRAINT `cutting_orders_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_reimbursement_id_fkey` FOREIGN KEY (`reimbursement_id`) REFERENCES `purchase_reimbursements`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_receipt_items` ADD CONSTRAINT `purchase_receipt_items_ingredient_id_fkey` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_receipt_items` ADD CONSTRAINT `purchase_receipt_items_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `purchase_receipts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_ingredient_id_fkey` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_ledger` ADD CONSTRAINT `inventory_ledger_ingredient_id_fkey` FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
