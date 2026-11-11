#!/bin/sh
set -eu

for value in "$DB_APP_PASSWORD" "$DB_MIGRATE_PASSWORD" "$DB_BACKUP_PASSWORD"; do
  printf '%s' "$value" | grep -Eq '^[A-Za-z0-9]{16,}$' || {
    echo "数据库账号密码必须是至少 16 位字母或数字" >&2
    exit 1
  }
done

mysql -h db -uroot <<SQL
CREATE USER IF NOT EXISTS 'lean_app'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';
ALTER USER 'lean_app'@'%' IDENTIFIED BY '${DB_APP_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON lean_kms.* TO 'lean_app'@'%';

CREATE USER IF NOT EXISTS 'lean_migrate'@'%' IDENTIFIED BY '${DB_MIGRATE_PASSWORD}';
ALTER USER 'lean_migrate'@'%' IDENTIFIED BY '${DB_MIGRATE_PASSWORD}';
GRANT ALL PRIVILEGES ON lean_kms.* TO 'lean_migrate'@'%';

CREATE USER IF NOT EXISTS 'lean_backup'@'%' IDENTIFIED BY '${DB_BACKUP_PASSWORD}';
ALTER USER 'lean_backup'@'%' IDENTIFIED BY '${DB_BACKUP_PASSWORD}';
GRANT SELECT, LOCK TABLES, SHOW VIEW, EVENT, TRIGGER ON lean_kms.* TO 'lean_backup'@'%';
SQL
