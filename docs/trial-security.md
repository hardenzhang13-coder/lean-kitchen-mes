# 试运行数据安全操作手册

## 1. 当前范围

- 保留现有 `admin`、`zhang`、`yang` 三个账号及其角色，不自动重置密码。
- 采购入口保持可见，但采购、报销、AI 识别与上传接口在试运行期间统一关闭。
- 关闭开关位于 `lib/shared/features.ts`，重新开放时改为 `purchases: true` 并重新构建。
- 采购历史表、数据和代码均保留，不做迁移删除。

## 2. 上线前账号操作

1. 分别登录三个账号，在“设置 → 个人设置”中修改为三个不同的强密码，至少 10 位。
2. 不要共享账号；离职或不再参与试运行时，由管理员在“设置 → 用户管理”中停用。
3. 修改密码、角色或停用账号后，旧会话版本立即失效。
4. 运行 `npm run audit:accounts` 检查三个账号是否仍有已知默认弱口令。

## 3. 数据库加密备份

在服务器 `.env` 中新增：

```bash
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 48)
```

将同一密钥另外保存在密码管理器中，不要只保存在 ECS 本地。备份容器每天生成
`backups/lean_kms-*.sql.gz.enc`，保留 30 天；未配置密钥时会拒绝产出明文备份。

恢复必须在独立临时数据库中验证：

```bash
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass env:BACKUP_ENCRYPTION_KEY \
  -in backups/lean_kms-YYYYMMDD_HHMMSS.sql.gz.enc |
  gunzip |
  docker compose exec -T db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lean_kms_restore
```

异地备份使用 rclone 同步到私有 OSS 桶：

```bash
RCLONE_REMOTE=lean-kms-oss RCLONE_PATH=lean-kms/backups \
  bash scripts/offsite-backup.sh
```

建议由服务器 cron 每日执行该脚本，并在阿里云监控中对 OSS 备份对象更新时间、
`backup` 容器健康状态和磁盘使用率配置告警。

## 3.1 数据库最小权限

Compose 会创建三个独立账号：

- `lean_app`：仅允许业务数据 `SELECT/INSERT/UPDATE/DELETE`
- `lean_migrate`：仅允许当前业务库的迁移权限
- `lean_backup`：仅允许备份所需读取权限

`.env` 中的三个密码必须是至少 16 位字母或数字，并执行：

```bash
chmod 600 .env
```

## 4. 域名 HTTPS 切换

ICP 备案与 DNS 完成前继续使用现有入口，只允许管理员使用。备案完成后在服务器 `.env` 配置：

```bash
APP_DOMAIN=kms.example.com
ACME_EMAIL=admin@example.com
FORCE_HTTPS=true
```

启动正式域名入口：

```bash
docker compose -f docker-compose.yml -f docker-compose.domain.yml up -d --build
```

该模式会移除 Web 容器的公网 `80` 端口，只保留 Caddy 的 `80/443`。验证通过后关闭直连 IP 入口；回滚时重新使用基础 Compose 启动。

## 5. 部署健康检查

- 本地脚本：设置 `PUBLIC_BASE_URL=https://正式域名`。
- GitHub Actions：设置仓库变量 `PUBLIC_BASE_URL` 与 `DEPLOY_DOMAIN_MODE=1`。
- 正式域名模式下，部署健康检查必须通过 HTTPS 域名返回 `200`。
