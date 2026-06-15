# 精益厨房 V3 (lean-kms-v3)

> 面向炒菜机器人生产模式的智能后厨管理系统。核心是对菜品做数字化 BOM 分解，驱动精准采购与切配，实现人机协同下的高效后厨管理。

## 项目状态：功能开发中

本项目在 **11 天内快速迭代** 交付了核心功能，以下模块已可用：

| 模块 | 状态 |
|------|------|
| 数据库设计 | ✅ 完成（25 张表） |
| 基础字典 | ✅ 完成 |
| 食材库 | ✅ 完成（5 类食材 + 批量导入） |
| 菜品库 | ✅ 完成（BOM + 工艺） |
| 工作台 | ✅ 完成 |
| 排程管理 | ✅ 完成（自动拆解切配工单 + 采购计划） |
| 采购管理 | ⚠️ 基础完成（录入/列表/AI识别/报销） |
| 库存管理 | ✅ 完成（实时库存 + 台账） |
| 用户权限 | ✅ 基础完成（4 角色） |
| 系统设置 | ✅ 完成 |

## 技术栈

| 层面 | 选型 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.7 |
| UI | React + Tailwind CSS v4 + shadcn/ui | 19.2.4 / v4 |
| 数据库 | PostgreSQL + Prisma 7 | — |
| 认证 | JWT (jose) | 自研 |
| AI 识别 | 通义千问 Qwen | 多模态图片识别 |
| 部署 | Zeabur | 自动检测 |

## 快速启动

### 1. 环境变量

复制 `.env.example` 为 `.env`，填入以下变量：

```bash
# 数据库（必须）
DATABASE_URL="postgresql://user:pass@host:port/db"

# 会话密钥（必须，生产环境请生成随机字符串）
SESSION_SECRET="your-random-secret-key"

# AI 识别（必须）
QWEN_API_KEY="your-qwen-api-key"
QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
QWEN_MODEL="qwen-vl-max"

# 图片存储（必须）
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_UPLOAD_PRESET="your-upload-preset"
```

### 2. 安装与初始化

```bash
npm install
npx prisma db push      # 推送数据库结构
npx prisma db seed      # 灌入基础字典数据（含默认账号）
npm run dev             # 开发服务器 http://localhost:3000
```

### 3. 生产构建

```bash
npm run build
# 输出到 .next/standalone，用于 Zeabur 部署
```

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建（含 prisma generate） |
| `npm run lint` | ESLint 检查 |
| `npx prisma db push` | 推送 schema 变更到数据库 |
| `npx prisma db seed` | 运行种子脚本 |
| `npx prisma generate` | 重新生成 Prisma Client |

## 默认账号

种子数据 `prisma/seed.ts` 创建：

| 账号 | 密码 | 角色 |
|------|------|------|
| zhang | 123456 | 业务运营 |
| yang | 123456 | 厨师长 |
| admin | admin123 | 系统管理员 |

## 文档索引

| 文档 | 内容 | 状态 |
|------|------|------|
| `memory-bank/Product.md` | 产品定义、目标用户、功能边界 | ✅ |
| `memory-bank/Design.md` | UI 设计规范、布局、颜色 | ✅ |
| `memory-bank/Database.md` | 数据库设计、25 张表、字段说明 | ✅ |
| `memory-bank/Router.md` | 页面路由、交互设计 | ✅ |
| `memory-bank/progress.md` | 项目推进日志、技术决策 | ✅ |
| `CLAUDE.md` | Claude Code 项目指南 | ✅ |
| `AGENTS.md` | AI Agent 工作区指令 | ✅ |

## 部署

当前部署在 **Zeabur**。每次部署前确保：
1. `DATABASE_URL` 已配置
2. `SESSION_SECRET` 已配置
3. `CLOUDINARY_CLOUD_NAME` 和 `CLOUDINARY_UPLOAD_PRESET` 已配置
4. `npm run build` 通过

---

> 项目初始化于 2026-06-04，当前活跃开发中。
