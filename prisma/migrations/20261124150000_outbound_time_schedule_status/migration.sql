-- 出库单新增业务出库时间，并按「出库后才完成」校准排程状态。
-- 存量出库时间回填 created_at；排程状态只按是否存在 confirmed 出库单校准。
ALTER TABLE `outbound_orders` ADD COLUMN `outbound_at` DATETIME(3) NULL;

UPDATE `outbound_orders`
SET `outbound_at` = `created_at`
WHERE `outbound_at` IS NULL;

ALTER TABLE `outbound_orders`
MODIFY COLUMN `outbound_at` DATETIME(3) NOT NULL;

-- 已出库但仍为进行中的历史排程收口为已完成。
UPDATE `schedules` AS `s`
JOIN `outbound_orders` AS `o`
  ON `o`.`schedule_id` = `s`.`id`
 AND `o`.`status` = 'confirmed'
SET `s`.`status` = '已完成'
WHERE `s`.`status` = '进行中';

-- 没有 valid 出库单的历史已完成排程回置为进行中，继续可创建出库单。
UPDATE `schedules` AS `s`
LEFT JOIN `outbound_orders` AS `o`
  ON `o`.`schedule_id` = `s`.`id`
 AND `o`.`status` = 'confirmed'
SET `s`.`status` = '进行中'
WHERE `s`.`status` = '已完成'
  AND `o`.`id` IS NULL;
