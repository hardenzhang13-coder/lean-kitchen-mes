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
| `npm test` | 运行 Jest 测试 |
| `npx prisma migrate dev` | 生成迁移文件（**仅本地开发**，禁止对生产使用） |
| `npx prisma migrate deploy` | 应用已有迁移（生产部署由 compose 的 `migrate` 服务执行） |
| `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` | **提交前必跑**：输出必须为空迁移 |
| `npx prisma db seed` | 运行种子脚本（`prisma/seed.ts`） |
| `npx prisma generate` | 重新生成 Prisma Client |

**注意：** 已配置 Jest 测试框架。核心算法测试见 `lib/server/__tests__/`、`lib/shared/__tests__/`、`lib/client/__tests__/`。如需新增，建议从核心算法和纯函数开始。

## 架构

### 技术栈
- **框架：** Next.js 16（App Router），React 19，TypeScript 5
- **数据库：** MySQL 8.4，通过 Prisma 7 及 `@prisma/adapter-mariadb` 连接
- **样式：** Tailwind CSS v4 + shadcn/ui（`style: base-rhea`）
- **认证：** 自研 JWT（jose，HS256），存储于 httpOnly cookie
- **AI/识别：** OpenAI SDK → 阿里通义千问，用于采购单识别
- **测试：** Jest 30 + @testing-library/react + supertest
- **图标：** lucide-react
- **通知：** sonner

### 关键目录

```
app/                  # Next.js App Router
  api/                # API 路由（REST，无 tRPC）
  components/         # 客户端组件（ui/ 通用业务封装层、dish-form/、dishes/、ingredients/、inventory/、production-plan/、schedule/ 业务域）
  ui-kit/             # 交互视觉基线可视验收页
lib/
  server/             # 服务端工具（prisma、api-auth、session、ai、schemas/、schedule-utils、production-plan-utils、dish-costing）
  shared/             # 前后端共用纯函数（utils、spec-parser、code-gen、name-utils、weight-format、net-price、display-format）
  client/             # 仅客户端（hooks、api、csv、use-pagination）
components/ui/        # shadcn/ui 原语（只通过 CLI 管理）
proxy.ts              # Next 16 的中间件（鉴权 / 权限 / 特性开关）
prisma/               # 数据库 Schema + 迁移 + 种子脚本
docs/                 # PRD、交互基线与专项方案
memory-bank/          # 项目长期记忆（产品 / 数据 / 路由 / 进度）
```

### 领域模型（全局视角）

系统核心为**三层食材体系**，驱动成本计算与采购；其下游是「排程 → 生产计划 → 净菜库存」闭环：

```
原料（Ingredient） → 净料（NetIngredient） → 菜品（Dish）
                          ↑                      ↑
                     出成率（yieldRate）      BOM 明细
```

- **原料（Ingredient）**：从供应商处采购的原始货物（如整只鸡）
- **净料（NetIngredient）**：经过初加工/预处理的食材，带有 `yieldRate`（如去骨鸡肉出成率 65%）。**小料与净料同表同口径**（l2Code 归属 MIN 一级分类），同样由原料转化而来
- **净料价格体系**（唯一真源 `lib/server/net-ingredient-utils.ts` 的 `deriveNetIngredientPrices()`）：净料单价 = 原料每斤单价 ÷ (出成率/100) → 成本价 = 净料单价 + 封装加工费 → 出库价 = 成本价 ÷ (1 − 毛利率/100) → 标准规格价（元/份）= 出库价 × 封装规格 ÷ 500。净料单价**强制由来源原料实时价格派生**，服务端忽略客户端传入的 `unitPrice`
- **`package_spec`（封装规格，单位 g）** 是「按份」换算的物理基准（一个标准包装装多少克）。缺失会导致：完成生产抛错整单回滚、出库金额算成 0、标签张数为 0、标准规格价显示「—」。补齐方案见 `docs/production-data-package-spec-plan.md`
- **菜品（Dish）**：由净料（主料/辅料）、小料（MIN 分类的转化净料）、调料（SeasoningIngredients）、酱料（SauceIngredients）及 `DishProcess` 工序组成

**排程 → 生产计划 → 净菜库存** 是当前业务主链路：
1. 用户创建 `Schedule`，选择日期、门店、菜品及份数
2. `lib/server/schedule-utils.ts` 中的 `buildCuttingOrders()` 按类别汇总净料/小料；`buildPurchasePlans()` 按出成率折算毛需求生成 `PurchasePlan` 行（**库存抵扣已随 v002 下线，建议采购量 = 毛需求**），两者在同一 `$transaction` 内创建
3. `lib/server/production-plan-utils.ts` 把多店排程合并为生产计划单（切配汇总 + 采购汇总），生成时固化来源排程快照
4. 「完成生产」按份逐行三态确认（完成 / 未完成 / 暂不确认），净菜入库（份 + g 双单位）→ 写台账 → 回写各店切配工单实际完成量
5. 出库单扣库存 + 写台账 + 标记是否按计划；作废走事务回滚（作废 ≠ 删除）

**采购流程：**
- `PurchaseReceipt` + `PurchaseReceiptItem` 记录实际到货
- AI 识别（`lib/server/ai.ts`）通过通义千问解析采购单图片，匹配到食材目录中的**原料**或**调料**
- **原料和调料均精确入库**：采购后更新对应库存量，并创建 `InventoryLedger` 流水记录
- 未匹配的食材可弹窗直接创建新的原料或调料，无需跳转页面
- 采购单状态：`待结算` / `已结算` / `已作废`。已结算后不可作废，作废后回滚库存
- `PurchaseReimbursement` 将多张采购单归并为报销单进行结算

**库存（v002 净菜库存，已替代旧原料库存）：**
- `PreppedStock` 追踪每种净料/小料的当前库存，**双单位**（`current_portions` 份为主、`current_qty` 克为辅）
- `PreppedStockLedger` 为不可篡改的双单位流水（`stock_in` / `stock_out` / `stock_rollback`）
- 旧表 `Inventory` / `InventoryLedger` 保留但**已停用**，库存变动不再由采购单触发
- 暂无手动调整 UI；库存变动仅通过「完成生产」与出库单触发

## 认证与中间件

认证为自研 JWT（非 NextAuth）。详见根目录 `proxy.ts` 及 `lib/server/session.ts`：

> ⚠️ **Next.js 16 已把 `middleware.ts` 更名为 `proxy.ts`**（构建输出显示为 `ƒ Proxy (Middleware)`）。仓库中不存在 `middleware.ts`，改中间件逻辑请改 `proxy.ts`。

- **代理中间件**（`proxy.ts`）在所有路由上验证 `session` cookie，除 `/login`、`/api/auth/*`、`/api/health` 外
- 会话剩余不足 15 分钟时**滑动续期**并回写 cookie；`sessionVersion` 变更可强制所有会话失效
- 对于 API 路由，注入 `x-user-id` / `x-username` / `x-user-role` / `x-user-session-version` 请求头，而非重定向
- **服务端动作/组件** 使用 `lib/server/session.ts` 的 `getCurrentUser()`
- **API 路由** 使用 `lib/server/api-auth.ts` 的 `getUserFromRequest(req)` 读取注入的请求头
- 权限：`lib/shared/access-control.ts` 的 `canAccessPage` / `canAccessApi` 集中表；**未登记的 API 默认仅管理员可访问**
- 试运行特性开关：`lib/shared/features.ts`（当前 `purchases: false`，同时锁页面与 `/api/purchase-*`）
- 操作日志（`OperationLog` 模型）通过 `logOperation()` 辅助函数写入

**环境变量：** `SESSION_SECRET` **没有硬编码兜底**。`lib/server/env-check-node.ts` 在 Node 启动阶段强制校验 `SESSION_SECRET`（≥32 字符）与 `DATABASE_URL`，缺失直接 `process.exit(1)`。

## 关键代码模式

### 单位换算
单位换算的唯一来源是 `units` 字典表（重量类单位的 `gramsPerUnit`）：服务端经 `lib/server/unit-factors.ts` 的 `getJinFactors()` 查询、用 `lib/shared/unit-conversion.ts` 的 `buildJinFactors()` 构建「单位名 → 每斤系数」，注入 `spec-parser.ts` / `weight-format.ts` 的纯函数（第三参/第二参可选）。`DEFAULT_JIN_PER_UNIT` 与 500g/斤 仅为调用方未注入时的兜底默认值，**改换算优先改字典**。

### Prisma 使用
`lib/server/prisma.ts` 使用 Prisma 7 的 `PrismaMariaDb` 适配器（`@prisma/adapter-mariadb`）连接 MySQL 8.4，开发环境下客户端以全局单例缓存。数据库为 **MySQL 8.4**：禁止 PG 特性（数组列、`mode: "insensitive"` 等）。

### API 路由模式
大多数 API 路由遵循以下结构：
```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logOperation, getUserFromRequest } from "@/lib/server/api-auth";
import { validateBody } from "@/lib/server/validate";
import { createXxxSchema } from "@/lib/server/schemas/xxx";

export async function GET(req: NextRequest) { /* ... */ }
export async function POST(req: NextRequest) { /* ... */ }
```

- **输入校验已全面接入 zod**：schema 统一放在 `lib/server/schemas/{domain}.ts`，通过 `validateBody` / `validateQuery` 使用
- **动态过滤不再使用 `any`**：`where` 一律标注为 `Prisma.XxxWhereInput`，多条件用 `where.AND` 组合
- **响应格式**统一走 `lib/server/api-response.ts`（`success` / `created` / `paginated` / `badRequest` / `notFound` / `conflict` / `internalError`）
- **列表 API 一律分页**（`page` / `pageSize` + `paginated`）

### 菜品成本口径
`lib/server/dish-costing.ts` 的 `getCurrentDishCostMap()` 按**当前**食材价格重算菜品成本（净料/小料按出库价、调料按每斤单价、酱料按配方成本 + 毛利率），**不信任 `Dish.cost` 历史快照**。菜品列表、菜品详情、排程详情均已接入。

### 客户端组件
许多页面均为 `"use client"`，通过 `fetch()` 向对应 `/api/*` 端点获取数据，而非使用服务端组件。共享组件位于 `app/components/`。

### 菜品创建向导
`app/components/dish-form/` 是菜品新建/编辑/查看的复合表单组件（页面级），在本地管理 BOM 状态，提交到：
1. `POST /api/dishes`（创建基础信息）
2. `PUT /api/dishes/[id]/bom`（保存 BOM）
3. `PUT /api/dishes/[id]/processes`（保存工序）

详见 [`app/components/dish-form/CLAUDE.md`](app/components/dish-form/CLAUDE.md)。

### 排程工具
`lib/server/schedule-utils.ts` 包含 BOM 拆解的核心业务逻辑。在排程创建时，于 Prisma `$transaction` 事务内调用。**请勿轻易修改**——它处理出成率计算、库存扣除逻辑及单位换算。

### CSV 处理
`lib/client/csv.ts` 提供自定义 CSV 解析/构建/下载工具。用于批量导入原料（`/api/ingredients/import`）。

## 样式约定

- Tailwind v4，在 `app/globals.css` 中使用 `@import "tailwindcss"` 语法
- 主题使用 oklch 色值及 CSS 变量
- 输入框聚焦使用 `primary` 色边框与柔和焦点环
- shadcn/ui 组件使用 `base-rhea` 风格变体
- 字体栈：系统中文无衬线字体（正文与标题）、系统等宽字体（数字与代码）
- 布局：左侧固定 80px 侧边栏，主内容区通过 `ml-20` 偏移
- 交互视觉以 `docs/interaction-visual-baseline-v1.md` 为唯一基线
- 页面骨架优先使用 `PageShell` / `PageHeader`；状态、空态、加载态和弹窗优先使用 `app/components/ui/` 下的业务封装
- 组件可视样张：`/ui-kit`

## 文档索引

| 文档 | 内容 |
|------|------|
| `CLAUDE.md`（本文件） | 项目全局概览与约定 |
| `AGENTS.md` | Kimi/Daimon 工作区安全红线与提交规范 |
| [`app/components/dish-form/CLAUDE.md`](app/components/dish-form/CLAUDE.md) | 菜品表单组件架构 |
| [`prisma/CLAUDE.md`](prisma/CLAUDE.md) | 数据库 Schema 与迁移 |
| [`app/api/dishes/CLAUDE.md`](app/api/dishes/CLAUDE.md) | 菜品 API 路由 |
| [`app/api/purchase-receipts/CLAUDE.md`](app/api/purchase-receipts/CLAUDE.md) | 采购单 API 与 AI 识别 |
| [`app/api/schedules/CLAUDE.md`](app/api/schedules/CLAUDE.md) | 排程 API 与业务链路 |
| [`memory-bank/INDEX.md`](memory-bank/INDEX.md) | 项目记忆库索引 |
| `memory-bank/Product.md` | 产品定义 |
| `memory-bank/Database.md` | 数据模型详情 |
| `memory-bank/Router.md` | 页面路由树 |
| `memory-bank/Design.md` | UI 设计规范 |
| `docs/interaction-visual-baseline-v1.md` | **当前交互视觉唯一基线** |
| `docs/interaction-visual-baseline-v1-rollout-plan.md` | 交互基线落地批次计划 + 62 条 lint 清理专项 |
| `docs/production-data-package-spec-plan.md` | 生产数据「封装规格」补齐方案（分阶段、含回滚） |
| `docs/协作错误清单.md` | **重大协作错误清单**：记录协作中的重大失误与改正动作 |
| `memory-bank/progress.md` | 项目推进日志 |
| `docs/` | 产品需求文档（PRD） |
| `design/` | 设计文档 |

## 命名约定

- **API 路由文件**：统一为 `route.ts`
- **动态路由目录**：`[id]/` 用于数字 ID
- **组件/工具文件**：kebab-case（如 `dish-sheet-detail.tsx`、`schedule-utils.ts`）
- **Schema 文件**：`lib/server/schemas/{domain}.ts`（如 `dish.ts`、`purchase.ts`、`schedule.ts`）
- **类型文件**：与业务模块同名，优先放在 `lib/server/schemas/` 或 `app/components/{feature}/types.ts`

## 开发工作流

### 提交前强制检查

所有代码提交前应执行：

```bash
npx tsc --noEmit
npm run build
npm run lint
```

### 新增 API 必选清单

1. 输入校验（zod schema 或严格手动校验）
2. 操作日志（`logOperation`）
3. 错误处理（标准响应格式）
4. 类型安全（禁止新增 `any`）
5. 分页（列表 API）
6. 权限检查（必要时按角色控制）

详见 `AGENTS.md` 完整规范。

### 数据库变更流程

1. 修改 `prisma/schema.prisma`
2. 执行 `npx prisma migrate dev` 生成迁移文件（**禁止对生产 `db push`**）
3. 更新 [`prisma/CLAUDE.md`](prisma/CLAUDE.md) 与 `memory-bank/Database.md`
4. 同步更新 `lib/server/schemas/` 下的 zod schema 与对应 API 路由
5. 提交前执行**零差异校验**：`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 必须输出空迁移

## 当前技术债

- **交互基线未全站落地**：62 条 lint warning 待清（弹窗像素宽度 31、正文字号 <12px 16、React Hooks 13、any/未使用变量 2），批次计划见 `docs/interaction-visual-baseline-v1-rollout-plan.md`
- **生产数据待办**：存量净料/小料 `package_spec` 未回填，阻断完成生产与出库金额，方案见 `docs/production-data-package-spec-plan.md`
- **旧库存表并存**：`inventory` / `inventory_ledger` 已停用但未清理，待定下线时点
- **采购模块锁定**：试运行期间 `TRIAL_FEATURES.purchases = false`，采购链路未在生产验证
- **测试覆盖**：现有 28 套件 / 158 用例，集中在纯函数与工具层；API 路由与 UI 组件覆盖仍薄，建议从 `lib/server/schedule-utils.ts`、`lib/server/production-plan-utils.ts` 和净菜库存链路补起
- **客户端组件化**：大量 `"use client"` + `fetch()`，服务端组件化可逐步推进

## 重要说明

- **Next.js 破坏性变更：** 这是 Next.js 16 配合 React 19。API 和约定可能与旧版本不同。不确定时，请查阅 `node_modules/next/dist/docs/`。详见 `AGENTS.md`。
- **菜品状态生命周期：** `draft` → `pending` → `published`。向导允许在任意步骤保存为 `draft`，或仅在校验通过后保存为 `published`。
- **测试已配置：** Jest 30 + @testing-library/react + supertest，当前 28 套件 / 158 用例全绿。新增测试优先覆盖纯函数与核心算法（`lib/server/__tests__/`、`lib/shared/__tests__/`、`lib/client/__tests__/`）。
- **部署：** `next.config.ts` 设置 `output: "standalone"`。构建需要 `DATABASE_URL` 环境变量。
