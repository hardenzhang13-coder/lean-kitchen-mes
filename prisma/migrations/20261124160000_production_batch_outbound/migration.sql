-- 生产批次出库：批次 = 切配计划单（PPL）。
-- 1) 新增批次余量表和出库单批次来源；2) 回填历史单据来源；3) 按台账净额初始化批次余量。

CREATE TABLE `prepped_stock_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `production_plan_id` INTEGER NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `source_id` INTEGER NOT NULL,
    `package_spec` INTEGER NULL,
    `planned_portions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `produced_portions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `current_portions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `current_qty` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prepped_stock_batches_production_plan_id_source_type_source__key`(`production_plan_id`, `source_type`, `source_id`),
    INDEX `prepped_stock_batches_source_type_source_id_idx`(`source_type`, `source_id`),
    INDEX `prepped_stock_batches_current_portions_idx`(`current_portions`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `outbound_orders` ADD COLUMN `production_plan_id` INTEGER NULL;
CREATE INDEX `outbound_orders_production_plan_id_idx` ON `outbound_orders`(`production_plan_id`);

-- 历史排程出库：通过排程 ↔ 切配计划关联回填批次来源。
UPDATE `outbound_orders` AS `o`
SET `o`.`production_plan_id` = (
    SELECT `ref`.`plan_id`
    FROM `production_plan_schedules` AS `ref`
    JOIN `production_plans` AS `p` ON `p`.`id` = `ref`.`plan_id`
    WHERE `ref`.`schedule_id` = `o`.`schedule_id`
    ORDER BY `p`.`created_at` DESC
    LIMIT 1
)
WHERE `o`.`schedule_id` IS NOT NULL
  AND `o`.`production_plan_id` IS NULL;

-- 历史内部生产单出库：通过内部生产单 ↔ 切配计划关联回填批次来源。
UPDATE `outbound_orders` AS `o`
SET `o`.`production_plan_id` = (
    SELECT `ref`.`plan_id`
    FROM `production_plan_self_orders` AS `ref`
    JOIN `production_plans` AS `p` ON `p`.`id` = `ref`.`plan_id`
    WHERE `ref`.`self_order_id` = `o`.`self_order_id`
    ORDER BY `p`.`created_at` DESC
    LIMIT 1
)
WHERE `o`.`self_order_id` IS NOT NULL
  AND `o`.`production_plan_id` IS NULL;

-- 批次期初 = 生产入库台账 - 已关联批次的历史出库 + 已关联批次的历史作废回滚。
-- 历史未关联批次的其他库存消耗不强行归属到 PPL，避免错误追溯。
INSERT INTO `prepped_stock_batches` (
    `production_plan_id`, `source_type`, `source_id`, `package_spec`,
    `planned_portions`, `produced_portions`, `current_portions`, `current_qty`,
    `created_at`, `updated_at`
)
SELECT
    `in_ledger`.`biz_id`,
    `in_ledger`.`source_type`,
    `in_ledger`.`source_id`,
    `n`.`package_spec`,
    `in_ledger`.`in_portions`,
    `in_ledger`.`in_portions`,
    GREATEST(0, `in_ledger`.`in_portions` + COALESCE(`usage`.`net_portions`, 0)),
    GREATEST(0, `in_ledger`.`in_qty` + COALESCE(`usage`.`net_qty`, 0)),
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM (
    SELECT
        `l`.`biz_id`,
        `l`.`source_type`,
        `l`.`source_id`,
        SUM(`l`.`change_portions`) AS `in_portions`,
        SUM(`l`.`change_qty`) AS `in_qty`
    FROM `prepped_stock_ledger` AS `l`
    WHERE `l`.`biz_type` = 'production_complete'
      AND `l`.`change_type` = 'stock_in'
      AND `l`.`biz_id` IS NOT NULL
    GROUP BY `l`.`biz_id`, `l`.`source_type`, `l`.`source_id`
) AS `in_ledger`
LEFT JOIN `net_ingredients` AS `n`
  ON `n`.`id` = `in_ledger`.`source_id`
LEFT JOIN (
    SELECT
        `o`.`production_plan_id`,
        `l`.`source_type`,
        `l`.`source_id`,
        SUM(
            CASE
                WHEN `l`.`change_type` = 'stock_out' THEN -`l`.`change_portions`
                ELSE `l`.`change_portions`
            END
        ) AS `net_portions`,
        SUM(
            CASE
                WHEN `l`.`change_type` = 'stock_out' THEN -`l`.`change_qty`
                ELSE `l`.`change_qty`
            END
        ) AS `net_qty`
    FROM `prepped_stock_ledger` AS `l`
    JOIN `outbound_orders` AS `o`
      ON `o`.`id` = `l`.`biz_id`
     AND `o`.`production_plan_id` IS NOT NULL
    WHERE `l`.`biz_type` IN ('outbound', 'outbound_void')
      AND `l`.`change_type` IN ('stock_out', 'stock_rollback')
    GROUP BY `o`.`production_plan_id`, `l`.`source_type`, `l`.`source_id`
) AS `usage`
  ON `usage`.`production_plan_id` = `in_ledger`.`biz_id`
 AND `usage`.`source_type` = `in_ledger`.`source_type`
 AND `usage`.`source_id` = `in_ledger`.`source_id`;

ALTER TABLE `prepped_stock_batches`
ADD CONSTRAINT `prepped_stock_batches_production_plan_id_fkey`
FOREIGN KEY (`production_plan_id`) REFERENCES `production_plans`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `outbound_orders`
ADD CONSTRAINT `outbound_orders_production_plan_id_fkey`
FOREIGN KEY (`production_plan_id`) REFERENCES `production_plans`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
