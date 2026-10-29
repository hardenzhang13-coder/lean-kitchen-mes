# 精益厨房 V3 阿里云部署指南

## 一、购买服务器（控制台操作）

1. 阿里云控制台 → **轻量应用服务器**（或 ECS）
2. 配置：**2核4G**（最低 2核2G）、系统镜像 **Ubuntu 22.04 LTS**、带宽 3-5Mbps
3. 购买后记录：**公网 IP**、root 密码（或重置密码）
4. 防火墙（控制台「防火墙」页面）放行：**80**、443（22 默认已开）

> 域名访问需 ICP 备案（约 1-2 周）。内部系统可直接用 `http://公网IP` 访问。

## 二、服务器初始化（SSH 登录后执行）

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# 2. 安装 Docker Compose 插件
apt-get update && apt-get install -y docker-compose-plugin

# 3. 配置 Docker 镜像加速（大陆服务器拉镜像快很多）
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.m.daocloud.io"
  ]
}
EOF
systemctl restart docker
```

## 三、上传代码（任选其一）

**方式 A：Git（推荐）**

```bash
apt-get install -y git
git clone https://github.com/hardenzhang13-coder/lean-kitchen-mes.git /opt/lean-kms-v3
cd /opt/lean-kms-v3
```

**方式 B：本地打包上传**

在本地项目目录执行（PowerShell）：

```powershell
tar -czf lean-kms-v3.tar.gz --exclude=node_modules --exclude=.next --exclude=.git --exclude=backups .
scp lean-kms-v3.tar.gz root@<公网IP>:/opt/
```

服务器上：`mkdir -p /opt/lean-kms-v3 && tar -xzf /opt/lean-kms-v3.tar.gz -C /opt/lean-kms-v3 && cd /opt/lean-kms-v3`

## 四、配置环境变量

在服务器项目根目录创建 `.env`：

```bash
cat > .env <<'EOF'
# 数据库密码（自定义，务必足够复杂）
DB_PASSWORD=换成强密码

# JWT 签名密钥，生成方式：openssl rand -base64 48
SESSION_SECRET=换成至少32位随机字符串

# 阿里云百炼（通义千问）API
QWEN_API_KEY=你的百炼API-KEY
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-max

# Cloudinary 图片存储
CLOUDINARY_CLOUD_NAME=你的cloud-name
CLOUDINARY_UPLOAD_PRESET=你的upload-preset
EOF
```

## 五、启动

```bash
docker compose up -d --build
```

首次启动约 5-10 分钟（构建镜像）。compose 会自动按顺序完成：

1. 启动 MySQL 8.4（数据持久化在 docker 卷 `mysqldata`，utf8mb4 编码）
2. 执行 `prisma migrate deploy` + `seed`（自动建表、写入默认账号）
3. 启动 Next.js 监听 80 端口
4. 启动每日备份任务（`./backups` 目录，保留 7 天）

验证：浏览器访问 `http://公网IP`，用 `admin / admin123` 登录。

## 六、登录后必做

1. **立即修改默认密码**（个人中心 → 修改密码）
2. 删除或停用不用的默认账号（zhang / yang）
3. 到「设置」里补充基础数据

## 七、常用运维命令

```bash
docker compose ps                 # 查看状态
docker compose logs -f web        # 看应用日志
docker compose logs -f db         # 看数据库日志
docker compose up -d --build web  # 更新代码后重建应用
ls backups/                       # 查看备份文件

# 手动备份
docker compose exec db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction lean_kms' | gzip > backups/manual-$(date +%F).sql.gz

# 从备份恢复（危险操作）
gunzip -c backups/xxx.sql.gz | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lean_kms'
```

## 八、一键/自动部署

代码更新到线上有两条等价路径，都执行 `git pull --ff-only && docker compose up -d --build`，
迁移和种子由 compose 的 `migrate` 服务自动完成。

### 方式 A：本地一键脚本（推荐日常使用）

```bash
DEPLOY_HOST=<公网IP> ./deploy.sh
```

脚本会 SSH 到服务器拉代码、重建容器，并轮询 `http://<公网IP>/login` 做健康检查。

**首次配置（只需一次）**：

```bash
# 1. 本地生成专用部署密钥（不要设密码短语）
ssh-keygen -t ed25519 -f ~/.ssh/aliyun_deploy -N ""

# 2. 把公钥装到服务器（root 登录密码）
ssh-copy-id -i ~/.ssh/aliyun_deploy.pub root@<公网IP>

# 3. 验证免密登录
ssh -i ~/.ssh/aliyun_deploy root@<公网IP> "echo ok"
```

### 方式 B：push 即部署（GitHub Actions）

`.github/workflows/deploy.yml` 已随仓库提供：push 到 `main` 自动部署。

**首次配置（只需一次）**：

1. 把上面生成的私钥内容复制出来：
   ```bash
   cat ~/.ssh/aliyun_deploy
   ```
2. GitHub 仓库页 → **Settings → Secrets and variables → Actions → New repository secret**，添加三个 secret：
   | Secret 名 | 值 |
   |-----------|-----|
   | `ALIYUN_HOST` | 服务器公网 IP |
   | `ALIYUN_USER` | `root`（或专用部署用户） |
   | `ALIYUN_SSH_KEY` | 上面 cat 出的私钥全文 |
3. 可选：`ALIYUN_PORT`，SSH 非 22 端口时设置。

**安全要求（配置 Actions 前必做）**：GitHub 运行器的出口 IP 不固定，
安全组放行 22 端口实际上等于对全网开放，因此服务器**必须关闭密码登录、只允许密钥**：

```bash
# 在服务器上执行，确认能用密钥登录后再开新终端验证，别退出当前会话
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 更新流程（两种方式任选）

```bash
# 本地开发机
git push origin main
# → Actions 自动部署；或手动执行方式 A 的 ./deploy.sh
```

## 注意事项

- `.env` 已在 `.gitignore` 和 `.dockerignore` 中排除，不会进入镜像或仓库
- 数据库不对外暴露端口（只在 Docker 内网），无需在防火墙开 3306
- 服务器代码必须用 **git clone** 管理；后续更新：`git push origin main`（Actions 自动部署）或 `./deploy.sh`（见「八、一键/自动部署」）
- 旧 Zeabur 数据已过期无法迁移，系统从 seed 基础数据重新开始
