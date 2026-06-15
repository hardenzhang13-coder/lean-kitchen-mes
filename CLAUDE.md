# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理本仓库代码时提供指引。

## 项目概述

**精益厨房管理系统 V3**（精益厨房 V3）—— 基于 Next.js 的中小型餐厅后厨运营管理系统。管理菜品配方（BOM）、生产排程、采购及库存。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动开发服务器，http://localhost:3000 |
| `npm run build` | 生产构建（执行 `prisma generate && next build`） |
| `npm run start` | 启动生产服务器（需先构建） |
| `npm run lint` | 运行 ESLint |
| `npx prisma db push` | 推送 schema 变更到 PostgreSQL |
| `npx prisma db seed` | 运行种子脚本（`prisma/seed.ts`） |
| `npx prisma generate` | 重新生成 Prisma Client |

**注意：** 目前尚未配置测试框架。如需添加测试，建议从核心算法（`schedule-utils.ts`）和规格解析（`spec-parser.ts`）开始。

## 架构

### 技术栈
- **框架：** Next.js 16（App Router），React 19，TypeScript 5
- **数据库：** PostgreSQL，通过 Prisma 7 及 `@prisma/adapter-pg` 连接
- **样式：** Tailwind CSS v4 + shadcn/ui（`style: base-rhea`）
- **认证：** 自研 JWT（jose，HS256），存储于 httpOnly cookie
- **AI/识别：** OpenAI SDK → 阿里通义千问，用于采购单识别
- **图标：** lucide-react
- **通知：** sonner

### 关键目录

```
app/                  # Next.js App Router
  (routes)/           # 页面路由（排程、菜品、库存等）
  api/                # API 路由（REST，无 tRPC）
  components/         # 共享客户端组件（侧边栏、向导等）
  lib/                # 客户端工具（csv.ts、schedule-utils.ts）
lib/                  # 服务端工具（prisma、auth、session、ai）
components/ui/        # shadcn/ui 组件
prisma/               # 数据库 Schema + 种子脚本
```

### 领域模型（全局视角）

系统核心为**三层食材体系**，驱动成本计算与采购：

```
原料（Ingredient） → 净料（NetIngredient） → 菜品（Dish）
                          ↑                      ↑
                     出成率（yieldRate）      BOM 明细
```

- **原料（Ingredient）**：从供应商处采购的原始货物（如整只鸡）
- **净料（NetIngredient）**：经过初加工/预处理的食材，带有 `yieldRate`（如去骨鸡肉出成率 65%）
- **菜品（Dish）**：由净料（主料/辅料）、小料（MinorIngredients）、调料（SeasoningIngredients）、酱料（SauceIngredients）及 `DishProcess` 工序组成

**排程（排程）** 是业务核心：
1. 用户创建 `Schedule`，选择菜品及份数
2. `app/lib/schedule-utils.ts` 中的 `buildCuttingOrders()` 按类别汇总净料/小料
3. `buildPurchasePlans()` 根据出成率计算毛需求，扣除当前库存，生成 `PurchasePlan` 行
4. `CuttingOrder` 和 `PurchasePlan` 在 Prisma `$transaction` 事务中自动创建

**采购流程：**
- `PurchaseReceipt` + `PurchaseReceiptItem` 记录实际到货
- AI 识别（`lib/ai.ts`）通过通义千问解析采购单图片，匹配到食材目录中的**原料**或**调料**
- **原料和调料均精确入库**：采购后更新对应库存量，并创建 `InventoryLedger` 流水记录
- 未匹配的食材可弹窗直接创建新的原料或调料，无需跳转页面
- 采购单状态：`待结算` / `已结算` / `已作废`。已结算后不可作废，作废后回滚库存
- `PurchaseReimbursement` 将多张采购单归并为报销单进行结算

**库存：**
- `Inventory` 追踪每种食材的当前库存量
- `InventoryLedger` 为不可篡改的交易流水（入库/出库）
- 暂无手动调整 UI；库存变动仅通过采购单自动入库触发

## 认证与中间件

认证为自研 JWT（非 NextAuth）。详见 `middleware.ts` 及 `lib/session.ts`：

- **中间件**（`middleware.ts`）在所有路由上验证 `session` cookie，除 `/login` 和 `/api/auth/*` 外
- 对于 API 路由，注入 `x-user-id` 和 `x-username` 请求头，而非重定向
- **服务端动作/组件** 使用 `lib/session.ts` 的 `getCurrentUser()`
- **API 路由** 使用 `lib/api-auth.ts` 的 `getUserFromRequest(req)` 读取注入的请求头
- 操作日志（`OperationLog` 模型）通过 `logOperation()` 辅助函数写入

**警告：** `lib/session.ts` 中 `SESSION_SECRET` 存在硬编码兜底值。生产环境必须设置环境变量。

## 关键代码模式

### Prisma 使用
`lib/prisma.ts` 使用 Prisma v5+ 的新 `PrismaPg` 适配器模式。开发环境下客户端以全局单例缓存。

### API 路由模式
大多数 API 路由遵循以下结构：
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logOperation, getUserFromRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) { /* ... */ }
export async function POST(req: NextRequest) { /* ... */ }
```

- Prisma `where` 子句常因动态过滤而使用 `const where: any = {}`。这是已知的技术债。
- **无输入校验层**（无 zod）。所有 POST 请求体在经过最少量的手动校验后直接使用。

### 客户端组件
许多页面均为 `"use client"`，通过 `fetch()` 向对应 `/api/*` 端点获取数据，而非使用服务端组件。共享组件位于 `app/components/`。

### 菜品创建向导
`app/components/dish-create-wizard.tsx` 是一个多步弹窗（非页面），在本地管理 BOM 状态，提交到：
1. `POST /api/dishes`（创建基础信息）
2. `PUT /api/dishes/[id]/bom`（保存 BOM）
3. `PUT /api/dishes/[id]/processes`（保存工序）

### 排程工具
`app/lib/schedule-utils.ts`（约 430 行）包含 BOM 拆解的核心业务逻辑。在排程创建时，于 Prisma `$transaction` 事务内调用。**请勿轻易修改**——它处理出成率计算、库存扣除逻辑及单位换算。

### CSV 处理
`app/lib/csv.ts` 提供自定义 CSV 解析/构建/下载工具。用于批量导入原料（`/api/ingredients/import`）。

## 样式约定

- Tailwind v4，在 `app/globals.css` 中使用 `@import "tailwindcss"` 语法
- 主题使用 oklch 色值及 CSS 变量
- 自定义聚焦样式：输入框使用蓝色环（`#007AFF`，苹果风格）
- shadcn/ui 组件使用 `base-rhea` 风格变体
- 字体栈：DM Sans（正文）、Public Sans（标题）、Geist（等宽）
- 布局：左侧固定 80px 侧边栏，主内容区通过 `ml-20` 偏移

## 重要说明

- **Next.js 破坏性变更：** 这是 Next.js 16 配合 React 19。API 和约定可能与旧版本不同。不确定时，请查阅 `node_modules/next/dist/docs/`。详见 `AGENTS.md`。
- **菜品状态生命周期：** `draft` → `pending` → `published`。向导允许在任意步骤保存为 `draft`，或仅在校验通过后保存为 `published`。
- **无测试覆盖：** 尚未配置测试框架。如需添加，建议从 `schedule-utils.ts`（BOM 计算）和 `spec-parser.ts`（规格解析）开始。
- **部署：** `next.config.ts` 设置 `output: "standalone"`。构建需要 `DATABASE_URL` 环境变量。
