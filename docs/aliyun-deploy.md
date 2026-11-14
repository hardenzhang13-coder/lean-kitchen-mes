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

# 应用/迁移/备份最小权限账号（至少 16 位字母或数字）
DB_APP_PASSWORD=GenerateAppPasswordA1
DB_MIGRATE_PASSWORD=GenerateMigratePasswordB2
DB_BACKUP_PASSWORD=GenerateBackupPasswordC3

# JWT 签名密钥，生成方式：openssl rand -base64 48
SESSION_SECRET=换成至少32位随机字符串

# 空库首个管理员；已有数据库不会覆盖现有账号
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=换成至少10位初始密码
INITIAL_ADMIN_NAME=管理员

# 加密备份密钥，生成方式：openssl rand -base64 48
BACKUP_ENCRYPTION_KEY=请另存到密码管理器

# 域名 HTTPS 完成后开启
FORCE_HTTPS=false

# 采购/AI 试运行期间暂不配置
QWEN_API_KEY=你的百炼API-KEY
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-max
CLOUDINARY_CLOUD_NAME=你的cloud-name
CLOUDINARY_UPLOAD_PRESET=你的upload-preset
EOF
```

## 五、启动

```bash
docker compose up -d --build
```

首次从源码启动约 5-10 分钟（构建镜像）；使用第八节的 ACR 预构建流程时，服务器只拉取现成镜像。compose 会自动按顺序完成：

1. 启动 MySQL 8.4（数据持久化在 docker 卷 `mysqldata`，utf8mb4 编码）
2. 创建 `lean_app`、`lean_migrate`、`lean_backup` 三个最小权限账号
3. 执行 `prisma migrate deploy` + `seed`（自动建表；已有账号不会被覆盖）
4. 启动 Next.js 监听 80 端口
5. 启动每日加密备份任务（`./backups`，保留 30 天）

验证：浏览器访问 `http://公网IP`，使用现有三个账号登录。源码不再提供固定默认密码。

## 六、登录后必做

1. `admin`、`zhang`、`yang` 分别修改为三个不同的强密码
2. 确认采购入口显示“试运行暂未开放”，采购页面和接口均不可用
3. 到「设置」里补充基础数据

## 七、常用运维命令

```bash
docker compose ps                 # 查看状态
docker compose logs -f web        # 看应用日志
docker compose logs -f db         # 看数据库日志
docker compose up -d --build web  # 仅回退/本地调试时使用；日常部署见第八节
ls backups/                       # 查看备份文件

# 备份为加密文件；恢复流程见 docs/trial-security.md
ls backups/
```

## 八、部署

默认不需要 ACR，也不需要新增任何密钥。直接使用原来的服务器构建方式即可。
不想配置 ACR 的话，看到方式 A / B 就够了，下面的 ACR 内容是以后想提速时的可选步骤。

### 方式 A：GitHub Actions（最简单）

GitHub 仓库 → **Actions → deploy → Run workflow**。

- 没有配置 `ACR_REGISTRY` / `ACR_NAMESPACE` 时：自动在服务器上执行 `docker compose up -d --build`；
- 配置了这两个 ACR 变量时：自动切换为 CI 预构建镜像模式。

迁移和种子仍由 compose 的 `migrate` 服务自动完成。

### 方式 B：本地一键脚本

默认仍是在服务器现场构建：

```bash
DEPLOY_HOST=<公网IP> ./deploy.sh
```

脚本会 SSH 到服务器拉代码、重建容器，并轮询 `http://<公网IP>/login` 做健康检查。

### 可选：配置 ACR 加速（以后再做）

如果以后觉得服务器构建仍然慢，再按下面步骤配置 ACR。配置完成后，工作流会自动切换到预构建模式，服务器只拉镜像。

1. 在阿里云容器镜像服务 ACR 创建**个人版**实例，地域选择与 ECS 相同的地域。
2. 创建一个命名空间，例如 `lean-kitchen`。仓库 `lean-kms-web` 和
   `lean-kms-migrate` 通常会在首次推送镜像时自动创建；若控制台提示仓库不存在，
   再手动新建这两个私有仓库。
3. 在服务器上登录 ACR（使用控制台显示的**公网地址**；个人版通常是
   `crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com` 这种形式，不要照抄
   `registry.cn-hangzhou.aliyuncs.com`）：

   ```bash
   docker login crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com
   ```

4. 在 GitHub 仓库 → **Settings → Secrets and variables → Actions** 配置：

   | 类型 | 名称 | 值 |
   |------|------|-----|
   | 变量 | `ACR_REGISTRY` | 控制台「公网地址」，例如 `crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com` |
   | 变量 | `ACR_NAMESPACE` | 例如 `lean-kitchen` |
   | 密钥 | `ACR_USERNAME` | ACR 用户名 |
   | 密钥 | `ACR_PASSWORD` | ACR 密码或访问凭证 |

   `ALIYUN_HOST`、`ALIYUN_USER`、`ALIYUN_SSH_KEY` 继续使用原有配置。

5. 本地预构建模式：

   ```bash
   DEPLOY_PREBUILT=1 \
   ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com \
   ACR_NAMESPACE=lean-kitchen \
   DEPLOY_HOST=<公网IP> ./deploy.sh
   ```

### 首次配置 SSH 密钥（只需一次）

```bash
# 1. 本地生成专用部署密钥（不要设密码短语）
ssh-keygen -t ed25519 -f ~/.ssh/aliyun_deploy -N ""

# 2. 把公钥装到服务器（root 登录密码）
ssh-copy-id -i ~/.ssh/aliyun_deploy.pub root@<公网IP>

# 3. 验证免密登录
ssh -i ~/.ssh/aliyun_deploy root@<公网IP> "echo ok"
```

**安全要求（配置 Actions 前必做）**：GitHub 运行器的出口 IP 不固定，
安全组放行 22 端口实际上等于对全网开放，因此服务器**必须关闭密码登录、只允许密钥**：

```bash
# 在服务器上执行，确认能用密钥登录后再开新终端验证，别退出当前会话
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 回退：服务器现场构建

如果 ACR 或 CI 暂时不可用，可以保留原来的服务器构建方式：

```bash
DEPLOY_PREBUILT=0 DEPLOY_HOST=<公网IP> ./deploy.sh
```

也可以 SSH 到服务器手动执行：

```bash
cd /opt/lean-kms-v3
git pull --ff-only
docker compose up -d --build
```

仅修改 Compose、环境变量或运行时配置时，优先使用无构建部署：

```bash
DEPLOY_NO_BUILD=1 DEPLOY_HOST=<公网IP> ./deploy.sh
```

### 更新与回滚流程

```bash
# 本地开发机
git push origin main
# → 人工到 GitHub Actions 触发 deploy
```

镜像 tag 使用 Git 提交 SHA，回滚时可以指定旧提交：

```bash
DEPLOY_PREBUILT=1 \
ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com \
ACR_NAMESPACE=lean-kitchen \
DEPLOY_IMAGE_TAG=<旧提交SHA> \
DEPLOY_HOST=<公网IP> ./deploy.sh
```

## 注意事项

- `.env` 已在 `.gitignore` 和 `.dockerignore` 中排除，不会进入镜像或仓库
- 数据库不对外暴露端口（只在 Docker 内网），无需在防火墙开 3306
- 服务器代码必须用 **git clone** 管理；后续更新先 push，再人工触发 GitHub Actions 或执行 `./deploy.sh`
- ACR 镜像地址和登录凭证只放在 GitHub Secrets / Variables 及服务器 Docker 配置中，不要写入仓库
- 旧 Zeabur 数据已过期无法迁移，系统从 seed 基础数据重新开始
