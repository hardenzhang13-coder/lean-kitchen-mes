#!/usr/bin/env bash
# 生产恢复脚本：20261105033151_workbench_store_sales_price 迁移失败后的自愈
#
# 背景：2026-11-05 部署中该迁移给存量排程回填 store_id=1 后，在空 stores 表上加外键，
# 触发 MySQL 存量行校验（ERROR 1452），迁移记录为 failed，前序语句已部分应用。
# 修复版迁移已预置默认门店（id=1 新金食堂），本脚本清理残留后重新应用。
#
# 本脚本幂等，可重复执行。用法（阿里云服务器）：
#   cd /opt/lean-kms-v3
#   git pull --ff-only
#   bash scripts/recover-store-migration.sh

set -euo pipefail
cd "$(dirname "$0")/.."

MIGRATION='20261105033151_workbench_store_sales_price'

echo "==> [1/5] 诊断迁移状态"
STATUS=$(
  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lean_kms -N -B' <<SQL
SELECT IFNULL((SELECT CASE WHEN finished_at IS NULL THEN 'failed' ELSE 'applied' END
  FROM _prisma_migrations WHERE migration_name='$MIGRATION'), 'missing')
SQL
)
echo "    $MIGRATION => $STATUS"

if [ "$STATUS" = "applied" ]; then
  echo "==> 迁移已正常应用，无需清理，直接拉起服务并跳到健康检查"
  docker compose up -d --build
elif [ "$STATUS" = "failed" ]; then
  echo "==> [2/5] 标记失败迁移为已回滚（migrate resolve --rolled-back）"
  docker compose run --rm migrate npx prisma migrate resolve --rolled-back "$MIGRATION"

  echo "==> [3/5] 清理部分应用的迁移产物（均为本次新增的空列/空表，零业务数据丢失）"
  docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lean_kms' <<'SQL'
SET @ddl := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dishes' AND COLUMN_NAME = 'price') > 0,
  'ALTER TABLE `dishes` DROP COLUMN `price`', 'SELECT 1'));
PREPARE p FROM @ddl; EXECUTE p; DEALLOCATE PREPARE p;

SET @ddl := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_items' AND COLUMN_NAME = 'actual_sold_qty') > 0,
  'ALTER TABLE `schedule_items` DROP COLUMN `actual_sold_qty`', 'SELECT 1'));
PREPARE p FROM @ddl; EXECUTE p; DEALLOCATE PREPARE p;

SET @ddl := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'store_id') > 0,
  'ALTER TABLE `schedules` DROP COLUMN `store_id`', 'SELECT 1'));
PREPARE p FROM @ddl; EXECUTE p; DEALLOCATE PREPARE p;

SET @ddl := (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores') > 0,
  'DROP TABLE `stores`', 'SELECT 1'));
PREPARE p FROM @ddl; EXECUTE p; DEALLOCATE PREPARE p;
SQL
else
  echo "==> [2/5] 无失败记录（迁移尚未执行），跳过回滚与清理"
fi

echo "==> [4/5] 重新应用迁移（修复版：预置默认门店后再加外键）"
docker compose run --rm migrate npx prisma migrate deploy

echo "==> [5/5] 重建并拉起全部服务（migrate 服务会补跑 seed）"
docker compose up -d --build

echo "==> 健康检查"
for i in $(seq 1 30); do
  code=$(docker run --rm --network host curlimages/curl -s -o /dev/null -w "%{http_code}" \
    --connect-timeout 5 http://localhost/login 2>/dev/null || true)
  if [ "$code" = "200" ]; then
    echo "==> 恢复完成，服务正常（HTTP 200）"
    exit 0
  fi
  sleep 10
done

echo "!! 健康检查 5 分钟未通过，请排查：docker compose ps && docker compose logs web" >&2
exit 1