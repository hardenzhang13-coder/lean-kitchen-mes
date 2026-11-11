#!/usr/bin/env bash
set -euo pipefail

# 将已加密备份同步到阿里云 OSS S3 兼容远端。
# 前置：安装并配置 rclone，例如 remote 名称 lean-kms-oss。
# 用法：
#   RCLONE_REMOTE=lean-kms-oss RCLONE_PATH=lean-kms/backups \
#     ./scripts/offsite-backup.sh

BACKUP_DIR="${BACKUP_DIR:-/opt/lean-kms-v3/backups}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_PATH="${RCLONE_PATH:-lean-kms/backups}"

if [ -z "$RCLONE_REMOTE" ]; then
  echo "RCLONE_REMOTE 未配置" >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "未安装 rclone" >&2
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "备份目录不存在: $BACKUP_DIR" >&2
  exit 1
fi

latest=$(find "$BACKUP_DIR" -name 'lean_kms-*.sql.gz.enc' -type f -printf '%T@ %p\n' |
  sort -nr |
  head -n 1 |
  cut -d' ' -f2-)
if [ -z "$latest" ]; then
  echo "没有可上传的加密备份" >&2
  exit 1
fi

rclone copy "$latest" "${RCLONE_REMOTE}:${RCLONE_PATH}/" --immutable
rclone delete "${RCLONE_REMOTE}:${RCLONE_PATH}/" --min-age 30d
echo "已上传加密备份: $latest"
