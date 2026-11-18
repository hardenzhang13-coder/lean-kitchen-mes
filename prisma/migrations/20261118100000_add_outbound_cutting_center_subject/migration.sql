-- 出库单支持切配中心主体：来源为内部生产单，门店主体的 store_id / schedule_id 改为可空
ALTER TABLE `outbound_orders` ADD COLUMN `self_order_id` INTEGER NULL,
    ADD COLUMN `subject_type` VARCHAR(191) NOT NULL DEFAULT 'store',
    MODIFY `schedule_id` INTEGER NULL,
    MODIFY `store_id` INTEGER NULL;

CREATE INDEX `outbound_orders_self_order_id_idx` ON `outbound_orders`(`self_order_id`);

ALTER TABLE `outbound_orders` ADD CONSTRAINT `outbound_orders_self_order_id_fkey` FOREIGN KEY (`self_order_id`) REFERENCES `self_production_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
