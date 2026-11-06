-- AlterTable
ALTER TABLE `ingredients` ADD COLUMN `default_supplier_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `purchase_plans` ADD COLUMN `supplier_id` INTEGER NULL,
    ADD COLUMN `supplier_name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sauce_ingredients` ADD COLUMN `default_supplier_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `ingredients` ADD CONSTRAINT `ingredients_default_supplier_id_fkey` FOREIGN KEY (`default_supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sauce_ingredients` ADD CONSTRAINT `sauce_ingredients_default_supplier_id_fkey` FOREIGN KEY (`default_supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_plans` ADD CONSTRAINT `purchase_plans_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
