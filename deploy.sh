#!/usr/bin/env bash
# 一键部署：SSH 到阿里云服务器拉取最新代码并重建容器（含健康检查）。
#
# 用法（在 Git Bash / WSL / macOS / Linux 下均可）：
#   DEPLOY_HOST=<公网IP> ./deploy.sh
#
# 可选项（环境变量覆盖）：
#   DEPLOY_USER  默认 root
#   DEPLOY_PATH  默认 /opt/lean-kms-v3
#   SSH_KEY      默认 ~/.ssh/aliyun_deploy
#
# 首次使用前的密钥配置见 docs/aliyun-deploy.md 「八、一键/自动部署」。

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/lean-kms-v3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aliyun_deploy}"

if [ -z "$DEPLOY_HOST" ]; then
  echo "请设置 DEPLOY_HOST，例如：DEPLOY_HOST=1.2.3.4 ./deploy.sh" >&2
  exit 1
fi

echo "==> 部署到 ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "cd '${DEPLOY_PATH}' && git pull --ff-only && docker compose up -d --build"

echo "==> 健康检查 http://${DEPLOY_HOST}/login"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://${DEPLOY_HOST}/login" || true)
  if [ "$code" = "200" ]; then
    echo "==> 部署完成，服务正常（HTTP 200）"
    exit 0
  fi
  sleep 10
done

echo "!! 健康检查 5 分钟内未通过，请 SSH 到服务器排查：" >&2
echo "   docker compose ps && docker compose logs web" >&2
exit 1
