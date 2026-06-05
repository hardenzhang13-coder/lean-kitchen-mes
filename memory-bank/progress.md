# 精益厨房 V3 — 项目推进日志

> 按日期记录核心推进过程，包括技术决策、问题解决、功能交付。

---

## 2026-06-04（Day 1）— 项目初始化与设计

### 完成内容

- **项目脚手架搭建**：Next.js 16 + React 19 + Tailwind CSS v4 + Prisma 7 + PostgreSQL
- **设计文档定稿**：
  - `Product.md` — 产品定义与核心功能边界
  - `Database.md` — 23 张表的数据库设计（含完整字段、关系、种子数据规划）
  - `Router.md` — 18 个页面的路由树与交互设计
  - `Design.md` — UI 设计规范
- **Prisma Schema 编写**：完成 23 个模型的定义，覆盖基础字典、食材库、菜品档案、排程、采购库存五大模块

### 技术决策

- 使用 Prisma 7 管理 ORM，PostgreSQL 作为数据库
- 采用 shadcn/ui + Tailwind v4 作为 UI 组件体系
- 侧边栏采用固定 80px 紧凑图标式导航

### 遗留问题

- 数据层（Prisma Client 初始化）未走通，数据库连接存在问题
- 尚未执行数据库迁移和建表

---

## 2026-06-05（Day 2）— 数据层打通 + 数据字典 + 食材库 + 部署

### 上午：数据层根因修复

**问题诊断**：
- Prisma 7 与旧版本有颠覆性变化：
  1. `schema.prisma` 中不再直接写 `url = env("DATABASE_URL")`，改由 `prisma.config.ts` 管理
  2. `PrismaClient` 构造函数**必须**传入 `adapter`（`@prisma/adapter-pg`），不允许无参构造
- 项目代码按 Prisma 5 习惯写的 `new PrismaClient()` 在 Prisma 7 下直接抛错
- `seed.ts` 缺少 `dotenv/config` 导入，直接运行脚本时读不到环境变量

**修复动作**：
- `lib/prisma.ts` — 改为 `@prisma/adapter-pg` 初始化
- `prisma/seed.ts` — 补充 `dotenv/config` + adapter 初始化
- `prisma.config.ts` — 补充 `seed` 命令配置
- 执行 `prisma db push` 同步全部 23 张表结构
- 执行 `seed.ts` 灌入基础字典数据（19 菜品类别 / 15 单位 / 8+25 食材分类）

### 上午：数据字典 CRUD 完整交付

**API 层**：
- 4 个字典资源全部补齐 REST API（GET / POST / PUT / DELETE / GET by id）
  - `/api/dish-categories`
  - `/api/ingredient-categories`
  - `/api/units`
  - `/api/suppliers`

**前端层**：
- 工作台首页（6 个模块入口卡片）
- 数据字典总览页 `/dictionaries`
- 4 个字典 CRUD 子页面（表格 + Modal 表单 + 删除确认）
- 侧边栏导航组件

**交互优化（下午第一批次）**：
- 全局可点击元素 `cursor: pointer`
- 二级页面返回按钮
- 表格增加序号列
- 表单放大 + 苹果风格聚焦阴影
- 局部加载骨架屏动画

### 下午：食材库完整模块

**数据库修复**：
- `prisma db pull` 之前把大量中文字段（`@map("计量单位")` 等）注释掉了
- 恢复所有被注释字段，统一改为英文字段名 + `@map("英文")`
- 重新 `prisma db push` 同步数据库

**API 层**：
- 5 类食材全部补齐 REST API
  - `/api/ingredients`（原料）
  - `/api/net-ingredients`（净料）
  - `/api/minor-ingredients`（小料）
  - `/api/seasoning-ingredients`（调料）
  - `/api/sauce-ingredients`（酱料）

**前端层**：
- 食材库总览页 `/ingredients`（5 张卡片入口）
- 5 个食材 CRUD 子页面，每个页面包含完整的字段表单

### 下午：表单体验深度优化

- **表单聚焦阴影**：`rgba(0,122,255,0.15)` → `rgba(0,122,255,0.06)`，更淡更柔和
- **编号自动生成**：API 层 POST 时按前缀+序号自动编码（ING/PRD/SML/SEA/SAU）
- **表单分组展示**：基础信息 / 分类信息 / 规格与价格 / 储存信息，分区块呈现
- **必填标识**：Label 加红色 `*`（必填）和灰色 `(可选)`
- **级联选择**：原料页面的一级/二级分类联动下拉

### 晚上：部署准备与上线

**部署配置**：
- `next.config.ts` — 添加 `output: "standalone"`
- `package.json` — build 脚本加入 `prisma generate`
- 代码推送到 GitHub：`hardenzhang13-coder/lean-kitchen-mes`

**Zeabur 部署**：
- 创建 Zeabur 项目，从 GitHub 导入
- 配置 `DATABASE_URL` 环境变量
- 绑定免费 `.zeabur.app` 域名
- 线上验证通过，数据正常读取

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 23 张表，结构已同步到线上 PG |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，完整 CRUD |
| 食材库 | ✅ 完成 | 原料 / 净料 / 小料 / 调料 / 酱料，完整 CRUD |
| 工作台 | ✅ 完成 | 模块入口总览 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署，免费域名可访问 |
| 菜品库 | ❌ 未开始 | 菜品档案、配方、加工流程 |
| 排程管理 | ❌ 未开始 | 排程 / 采购计划 / 切配工单 |
| 采购管理 | ❌ 未开始 | 采购单录入 / 大模型识别 |
| 库存管理 | ❌ 未开始 | 库存实况 / 库存台账 |

---

## 关键技术决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| Prisma Client 初始化 | `@prisma/adapter-pg` | Prisma 7 强制要求传入 adapter |
| 组件库 | 保持 shadcn/ui | 已深度集成，与 Next.js 16 / Tailwind v4 完全兼容 |
| 部署平台 | Zeabur | 支持 Next.js 自动检测，一键部署 |
| 数据库 | 复用同一套远程 PG | 本地开发与线上生产数据一致 |
| 编号生成 | 服务端自动生成 | 避免人工输入编号格式错误，保证唯一性 |

---

## 已知问题与 TODO

- [ ] 食材分类级联选择目前只做了原料页面，净料/小料/调料/酱料的分类字段仍为文本输入
- [ ] 菜品库模块（菜品档案、配方、加工流程）待开发
- [ ] 排程模块（排程创建 → 自动分解为采购计划 + 切配工单）待开发
- [ ] 采购模块（大模型识别采购单照片）待开发
- [ ] 库存模块（出入库流水、库存预警）待开发
- [ ] 用户认证与权限控制尚未设计
