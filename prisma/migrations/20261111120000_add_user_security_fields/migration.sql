-- 账号安全状态与会话版本：停用/软删除/改密/改角色后可立即使旧会话失效
ALTER TABLE `users`
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `session_version` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `deleted_at` DATETIME(3) NULL;

CREATE INDEX `users_deleted_at_idx` ON `users`(`deleted_at`);
