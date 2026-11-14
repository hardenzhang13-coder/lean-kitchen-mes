# 精益厨房 V3 (lean-kms-v3)

> 面向炒菜机器人生产模式的智能后厨管理系统。核心是对菜品做数字化 BOM 分解，驱动精准采购与切配，实现人机协同下的高效后厨管理。

## 项目状态：试运行中

2026-11 起进入试运行，核心链路「排程 → 生产计划 → 切配完成 → 净菜入库 → 出库」已跑通：

| 模块 | 状态 |
|------|------|
| 数据库设计 | ✅ 完成（34 张表 / 29 个迁移） |
| 基础字典 | ✅ 完成（分类、类别、单位、门店、供应商、**净菜包装**） |
| 食材库 | ✅ 完成（5 类食材 + 批量导入 + 转化流程图） |
| 菜品库 | ✅ 完成（BOM + 工艺 + 成本实时重算） |
| 工作台 | ✅ 完成 |
| 排程管理 | ✅ 完成（自动拆解切配工单 + 采购计划 + 销售回录） |
| 生产计划单 | ✅ 完成（跨店合并 + 按份三态确认 + 标签打印） |
| 库存管理 | ✅ 完成（v002 净菜库存：份/g 双单位 + 出库单 + 台账） |
| 采购管理 | ⏸ 试运行暂未开放（入口保留，接口锁定，`TRIAL_FEATURES.purchases = false`） |
| 用户权限 | ✅ 基础完成（4 角色 + 集中权限表） |
| 系统设置 | ✅ 完成 |
| 交互视觉基线 | 🔄 分批落地中（组件层已完成，批次计划见 `docs/interaction-visual-baseline-v1-rollout-plan.md`） |

> ⚠️ **生产数据待办**：存量净料/小料的「封装规格」未回填，会阻断完成生产并导致出库金额算成 0。处理方案见 `docs/production-data-package-spec-plan.md`。

## 技术栈

| 层面 | 选型 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.7 |
| UI | React + Tailwind CSS v4 + shadcn/ui | 19.2.4 / v4 |
| 数据库 | MySQL 8.4 + Prisma 7 | — |
| 认证 | JWT (jose) | 自研 |
| AI 识别 | 通义千问 Qwen | 采购功能重新开放后启用 |
| 部署 | 阿里云 ECS | Docker Compose + Caddy HTTPS |

## 快速启动

### 1. 环境变量

复制 `.env.example` 为 `.env`，填入以下变量：

```bash
# 数据库（必须）
DATABASE_URL="mysql://user:pass@host:port/db"

# 会话密钥（必须，至少 32 位）
SESSION_SECRET="your-random-secret-key-at-least-32-characters"

# 空库首次管理员（已有数据库不会覆盖现有账号）
INITIAL_ADMIN_PASSWORD="your-secure-initial-password"

# Docker Compose 最小权限数据库账号
DB_APP_PASSWORD="GenerateAppPasswordA1"
DB_MIGRATE_PASSWORD="GenerateMigratePasswordB2"
DB_BACKUP_PASSWORD="GenerateBackupPasswordC3"

# 加密备份密钥
BACKUP_ENCRYPTION_KEY="your-separately-stored-backup-key"
```

### 2. 安装与初始化

```bash
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev             # 开发服务器 http://localhost:3000
```

### 3. 生产构建

```bash
npm run build
# 输出到 .next/standalone，用于 Docker 部署
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建（含 prisma generate） |
| `npm run lint` | ESLint 检查 |
| `npm test` | Jest 测试（28 套件 / 158 用例） |
| `npx prisma migrate dev` | 本地生成迁移文件（**禁止对生产使用**） |
| `npx prisma migrate deploy` | 应用已有迁移 |
| `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` | 提交前零差异校验，必须输出空迁移 |
| `npx prisma db seed` | 运行种子脚本 |
| `npx prisma generate` | 重新生成 Prisma Client |

## 试运行账号

现有 `admin`、`zhang`、`yang` 三个账号及其角色继续保留。上线前必须分别修改为三个不同的强密码；源码不再创建固定弱口令账号。空库部署通过 `INITIAL_ADMIN_*` 环境变量创建首个管理员。

## 文档索引

| 文档 | 内容 | 状态 |
|------|------|------|
| `memory-bank/Product.md` | 产品定义、目标用户、功能边界 | ✅ |
| `memory-bank/Design.md` | UI 设计规范、布局、颜色 | ✅ |
| `memory-bank/Database.md` | 数据库设计、25 张表、字段说明 | ✅ |
| `memory-bank/Router.md` | 页面路由、交互设计 | ✅ |
| `memory-bank/progress.md` | 项目推进日志、技术决策 | ✅ |
| `docs/interaction-visual-baseline-v1.md` | **当前交互视觉唯一基线** | ✅ |
| `docs/interaction-visual-baseline-v1-rollout-plan.md` | 交互基线落地批次计划 + lint 清理专项 | ✅ |
| `docs/production-data-package-spec-plan.md` | 生产数据「封装规格」补齐方案 | ✅ |
| `docs/trial-security.md` | 试运行账号、备份、HTTPS 与回滚流程 | ✅ |
| `CLAUDE.md` | Claude Code 项目指南 | ✅ |
| `AGENTS.md` | AI Agent 工作区指令 | ✅ |

## 部署

当前部署在阿里云 ECS。正式域名完成 ICP 后使用 `docker-compose.domain.yml` 增加 Caddy HTTPS 入口；详细步骤见 `docs/trial-security.md` 和 `docs/aliyun-deploy.md`。

---

> 项目初始化于 2026-06-04，2026-11 进入试运行，当前活跃开发中。
