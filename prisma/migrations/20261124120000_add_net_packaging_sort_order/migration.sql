-- AlterTable
-- 说明：sort_order 仅用于展示顺序。存量行统一为 0，列表按 (sort_order, id) 排序，
-- 同为 0 时按 id 升序，保持迁移前的展示顺序不变；用户首次调整顺序后写入 1..N。
ALTER TABLE `net_packagings` ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;
