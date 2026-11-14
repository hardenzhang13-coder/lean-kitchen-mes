#!/usr/bin/env bash
# 一键部署：SSH 到阿里云服务器拉取最新代码并更新容器（含健康检查）。
# 注：部署末尾会灌入 scripts/dictionary-baseline.sql 做字典基线初始化（INSERT IGNORE 只增不覆盖）。
#
# 用法（在 Git Bash / WSL / macOS / Linux 下均可）：
#   DEPLOY_HOST=<公网IP> ./deploy.sh
#
# 推荐：使用 ACR 预构建镜像，服务器不再现场构建（需要先在服务器执行一次 docker login）：
#   DEPLOY_PREBUILT=1 \
#   ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com \
#   ACR_NAMESPACE=lean-kitchen \
#   DEPLOY_HOST=<公网IP> ./deploy.sh
#
# 可选项（环境变量覆盖）：
#   DEPLOY_USER  默认 root
#   DEPLOY_PATH  默认 /opt/lean-kms-v3
#   SSH_KEY      默认 ~/.ssh/aliyun_deploy
#   DEPLOY_PREBUILT  默认 0；设为 1 时拉取 ACR 镜像部署
#   DEPLOY_IMAGE_TAG 默认当前本地 Git 提交 SHA
#   WEB_IMAGE / MIGRATE_IMAGE  可直接覆盖完整镜像地址
#
# 首次使用前的密钥配置见 docs/aliyun-deploy.md 「八、一键/自动部署」。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/lean-kms-v3}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/aliyun_deploy}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${DEPLOY_HOST}}"
DEPLOY_DOMAIN_MODE="${DEPLOY_DOMAIN_MODE:-0}"
DEPLOY_NO_BUILD="${DEPLOY_NO_BUILD:-0}"
DEPLOY_PREBUILT="${DEPLOY_PREBUILT:-0}"
DEPLOY_IMAGE_TAG="${DEPLOY_IMAGE_TAG:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)}"
ACR_REGISTRY="${ACR_REGISTRY:-}"
ACR_NAMESPACE="${ACR_NAMESPACE:-}"
WEB_IMAGE="${WEB_IMAGE:-}"
MIGRATE_IMAGE="${MIGRATE_IMAGE:-}"

COMPOSE_COMMAND="docker compose"
if [ "$DEPLOY_DOMAIN_MODE" = "1" ]; then
  COMPOSE_COMMAND="docker compose -f docker-compose.yml -f docker-compose.domain.yml"
fi

BASELINE_CMD="sh -c 'mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" lean_kms'"

if [ -z "$DEPLOY_HOST" ]; then
  echo "请设置 DEPLOY_HOST，例如：DEPLOY_HOST=1.2.3.4 ./deploy.sh" >&2
  exit 1
fi

if [ "$DEPLOY_PREBUILT" = "1" ]; then
  if [ -z "$WEB_IMAGE" ] || [ -z "$MIGRATE_IMAGE" ]; then
    : "${ACR_REGISTRY:?DEPLOY_PREBUILT=1 时必须设置 ACR_REGISTRY，或直接提供 WEB_IMAGE / MIGRATE_IMAGE}"
    : "${ACR_NAMESPACE:?DEPLOY_PREBUILT=1 时必须设置 ACR_NAMESPACE，或直接提供 WEB_IMAGE / MIGRATE_IMAGE}"
    : "${DEPLOY_IMAGE_TAG:?DEPLOY_PREBUILT=1 时必须设置 DEPLOY_IMAGE_TAG 或在 Git 仓库内运行}"
  fi

  WEB_IMAGE="${WEB_IMAGE:-${ACR_REGISTRY}/${ACR_NAMESPACE}/lean-kms-web:${DEPLOY_IMAGE_TAG}}"
  MIGRATE_IMAGE="${MIGRATE_IMAGE:-${ACR_REGISTRY}/${ACR_NAMESPACE}/lean-kms-migrate:${DEPLOY_IMAGE_TAG}}"
  UP_ARGS="-d --no-build"
  REMOTE_CMD="cd '${DEPLOY_PATH}' && git pull --ff-only && export WEB_IMAGE='${WEB_IMAGE}' MIGRATE_IMAGE='${MIGRATE_IMAGE}' && ${COMPOSE_COMMAND} pull web migrate && ${COMPOSE_COMMAND} up ${UP_ARGS} && ${COMPOSE_COMMAND} exec -T db ${BASELINE_CMD} < scripts/dictionary-baseline.sql"
  echo "==> 使用预构建镜像部署（tag: ${DEPLOY_IMAGE_TAG}）"
else
  UP_ARGS="-d --build"
  if [ "$DEPLOY_NO_BUILD" = "1" ]; then
    UP_ARGS="-d --no-build"
  fi
  REMOTE_CMD="cd '${DEPLOY_PATH}' && git pull --ff-only && ${COMPOSE_COMMAND} up ${UP_ARGS} && ${COMPOSE_COMMAND} exec -T db ${BASELINE_CMD} < scripts/dictionary-baseline.sql"
  echo "==> 使用服务器现场构建部署"
fi

echo "==> 部署到 ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_USER}@${DEPLOY_HOST}" \
  "$REMOTE_CMD"

echo "==> 健康检查 ${PUBLIC_BASE_URL%/}/login"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${PUBLIC_BASE_URL%/}/login" || true)
  if [ "$code" = "200" ]; then
    echo "==> 部署完成，服务正常（HTTP 200）"
    exit 0
  fi
  sleep 10
done

echo "!! 健康检查 5 分钟内未通过，请 SSH 到服务器排查：" >&2
echo "   docker compose ps && docker compose logs web" >&2
exit 1
