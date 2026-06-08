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

## 2026-06-08（Day 3）— 食材库迭代 + 菜品库完整交付

### 上午：食材库原料清单迭代

**批量导入功能**：
- 新增 `app/api/ingredients/import/route.ts` — CSV 批量导入 API（事务内生成连续编号）
- 新增 `ImportDialog` 组件 — 模板下载 → CSV 解析 → 预览校验（异常行标红）→ 确认导入
- 原料列表页新增「批量导入」按钮

**表单体验升级**：
- 弹窗加宽至 `sm:max-w-[900px]`，一屏完整展示无滚动条
- 字段重新排序：分类信息 → 基础信息（储存信息合并入内）
- 二级分类使用 `TileSelect` 弹窗平铺选择（选项超过 10 个）
- 新建 `SelectField` 统一下拉组件，替换所有页面的原生 `<select>`

**列表规范同步**：
- 原料列表补全所有字段（含季节限定、采购规格、一级分类）
- 默认 20 行/页，接入 `Pagination` 组件
- 该规范同步到净料/小料/调料/酱料 4 个清单

### 下午：菜品库完整功能交付

**数据库扩展**：
- Prisma Schema 新增 `DishIngredientDetail`（主料）和 `DishMinorDetail`（辅料）模型
- Dish 模型补充 `ingredientDetails` / `minorDetails` 关联
- 执行 `prisma generate` 同步类型

**API 层**：
- `app/api/dishes/route.ts` — 列表（支持多维度筛选）+ 创建
- `app/api/dishes/[id]/route.ts` — 单条查询/更新/删除（含完整 BOM 关联）
- `app/api/dishes/[id]/bom/route.ts` — BOM 批量替换（5 类食材），自动重算菜品成本
- `app/api/dishes/[id]/processes/route.ts` — 加工工艺批量替换

**前端页面**：
- `app/dishes/page.tsx` — 卡片式列表页
  - 菜品类别平铺 badge 筛选（主要筛选项）
  - 菜系/荤素辅助筛选 + 关键词搜索
  - 新增菜品向导（3 步弹窗：基础信息 → BOM → 工艺）
- `app/dishes/[id]/page.tsx` — 详情页
  - 左侧 `380px`：基础信息卡片（可编辑）
  - 右侧上方：BOM 清单（Tabs：主料/辅料/小料/净料/调料/酱料），支持查看/编辑
  - 右侧下方：加工工艺流程（按 stage 分组），支持增删改和排序

**新增可复用组件**：
- `DishCard` — 菜品卡片
- `IngredientPicker` — 食材搜索选择弹窗
- `ProcessTimeline` — 加工工艺时间线编辑

### 验证
- `npx tsc --noEmit` ✅ 通过
- `npm run build` ✅ 构建成功（34 个路由）
- 本地 dev server 启动，浏览器可正常访问

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表（原 23 + 新增 2 张 BOM 关联表） |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，完整 CRUD |
| 食材库 | ✅ 完成 | 5 类食材完整 CRUD + 批量导入 + 统一分页 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页（BOM + 工艺）+ 创建向导 |
| 工作台 | ✅ 完成 | 模块入口总览 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 排程管理 | ✅ 完成 | 排程创建（菜品选择器）/ 自动拆解切配工单+采购计划 / 状态流转 / 工作台展示 |
| 采购管理 | ✅ 完成 | 采购单录入（AI识别+图片上传+未匹配标记+快速录入）/ 采购报销（创建+导出） |
| 库存管理 | ✅ 完成 | 实时库存（按二级分类筛选+采购频次）/ 库存台账（出入库记录+结算状态） |

---

## 关键技术决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| Prisma Client 初始化 | `@prisma/adapter-pg` | Prisma 7 强制要求传入 adapter |
| 组件库 | 保持 shadcn/ui | 已深度集成，与 Next.js 16 / Tailwind v4 完全兼容 |
| 部署平台 | Zeabur | 支持 Next.js 自动检测，一键部署 |
| 数据库 | 复用同一套远程 PG | 本地开发与线上生产数据一致 |
| 编号生成 | 服务端自动生成 | 避免人工输入编号格式错误，保证唯一性 |
| BOM 表设计 | 5 张独立关联表 | 主料/辅料/净料/调料/酱料各一张，逻辑更清晰 |

---

## 2026-06-08（续）— 采购管理 + 库存管理完整交付

### 完成内容

**Schema 扩展**：
- `InventoryLedger` 新增 `settlementStatus`（默认「待结算」），支持台账结算状态跟踪

**API 层**：
- 修复 `/api/purchase-receipts/recognize` 调料匹配外键问题：调料匹配时 `ingredientId` 留空，不入库存
- 新建 `/api/upload` — Cloudinary 图片直传代理
- 增强 `POST /api/purchase-reimbursements` — 创建报销后自动将关联 ledger 标记为「已结算」

**前端页面**：
- 采购模块二级菜单：「采购单」/「采购报销」
- `/purchases/new` — 录入采购单（图片上传 → AI 识别 → 可编辑明细表格 → 未匹配食材红色高亮 + 一键录入）
- `/purchases/reimbursements` — 报销列表
- `/purchases/reimbursements/new` — 创建报销（时间范围筛选 + 多选采购单 + 金额合计）
- `/purchases/reimbursements/[id]` — 报销详情 + CSV 导出
- `/inventory` — 实时库存（二级分类筛选、搜索、采购频次、统计卡片）
- `/inventory/ledger` — 库存台账（时间范围/类型/结算状态筛选、badge 区分入库/出库）

### 验证
- `npx tsc --noEmit` ✅ 通过
- `npm run build` ✅ 构建成功（45 个路由）

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表（原 23 + 新增 2 张 BOM 关联表） |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，完整 CRUD |
| 食材库 | ✅ 完成 | 5 类食材完整 CRUD + 批量导入 + 统一分页 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页（BOM + 工艺）+ 创建向导 |
| 工作台 | ✅ 完成 | 模块入口总览 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 采购管理 | ✅ 完成 | 采购单录入（AI识别+图片上传+未匹配标记+快速录入）/ 采购报销（创建+导出） |
| 库存管理 | ✅ 完成 | 实时库存（按二级分类筛选+采购频次）/ 库存台账（出入库记录+结算状态） |
| 排程管理 | ❌ 未开始 | 排程 / 采购计划 / 切配工单 |

---

## 关键技术决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| Prisma Client 初始化 | `@prisma/adapter-pg` | Prisma 7 强制要求传入 adapter |
| 组件库 | 保持 shadcn/ui | 已深度集成，与 Next.js 16 / Tailwind v4 完全兼容 |
| 部署平台 | Zeabur | 支持 Next.js 自动检测，一键部署 |
| 数据库 | 复用同一套远程 PG | 本地开发与线上生产数据一致 |
| 编号生成 | 服务端自动生成 | 避免人工输入编号格式错误，保证唯一性 |
| BOM 表设计 | 5 张独立关联表 | 主料/辅料/净料/调料/酱料各一张，逻辑更清晰 |
| 图片存储 | Cloudinary Unsigned Upload | Zeabur 无状态容器不支持本地磁盘存储 |
| 库存模型 | 统一走原料库存 | 净料出库按出成率换算扣除对应原料；调料无映射不入库 |
| 结算状态 | 报销即视为结算 | 创建报销单后自动更新关联 ledger 记录 |

---

## 已知问题与 TODO

## 2026-06-08（续）— 排程管理完整交付

### 完成内容

**Schema 扩展**：
- `Schedule` 新增 `title`、`scope`（默认"全部食堂"），`status` 默认值改为「待生效」
- `CuttingOrder` 重构为通用模型：增加 `sourceType`（net/minor）、`sourceId`、`itemName`、`l1Code`/`l2Code`、`actualQty`
- `PurchasePlan` 重构为通用模型：增加 `sourceType`（ingredient/minor/seasoning/sauce）、`sourceId`、`itemName`、`l2Code`、`purchaseSpec`、`priceUnit`、`actualPurchase`、`actualAmount`
- 移除 `Ingredient.purchasePlans` 和 `NetIngredient.cuttingOrders` 反向关联（因采购/切配对象泛化）

**核心算法**：
- `app/lib/schedule-utils.ts` — 单位换算（克→斤/g）+ 切配工单构建 + 采购计划构建
- 自动拆解逻辑：菜品 BOM → 按食材类型汇总 → 计算总需求量 → 原料按出成率反算 → 扣除库存得建议采购量

**API 层（6 个接口）**：
- `GET /api/schedules` — 排程列表（支持状态/时间范围/关键词筛选）
- `POST /api/schedules` — 创建排程（事务内自动生成切配工单+采购计划）
- `GET /api/schedules/[id]` — 排程详情（含菜品清单/切配工单/采购计划，附分类名称）
- `PUT /api/schedules/[id]` — 修改排程（仅待生效，重新计算拆解）
- `DELETE /api/schedules/[id]` — 删除排程（仅待生效）
- `PUT /api/schedules/[id]/activate` — 确认生产计划（待生效→进行中）
- `PUT /api/schedules/[id]/complete` — 完成生产（进行中→已完成）
- `GET /api/schedules/active` — 获取进行中排程（供工作台调用）

**前端页面与组件**：
- `ScheduleCuttingTable` — 切配工单表格，按一二级分类合并单元格（rowspan），支持下载 CSV
- `SchedulePurchaseTable` — 采购计划表格，支持下载 CSV
- `/schedules` — 排程卡片列表，按状态 Tab 分组（默认"进行中"），支持时间范围/关键词筛选
- `/schedules/new` — 新建排程，左右分栏：左侧已选菜品清单（数量可调），右侧菜品卡片网格（搜索+分类筛选，点击添加）
- `/schedules/[id]` — 排程详情页（4 信息块）：基础信息卡+操作按钮（状态驱动）+菜单清单+切配工单+采购计划，22点超时检测提示
- `/schedules/[id]/edit` — 修改排程（仅待生效）
- `/page.tsx`（工作台）— 增加「今日排程」区域，进行中排程 Tab 切换展示，菜品清单摘要

### 验证
- `npx tsc --noEmit` ✅ 通过
- `npm run build` ✅ 构建成功（48 个路由）

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表（原 23 + 新增 2 张 BOM 关联表） |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，完整 CRUD |
| 食材库 | ✅ 完成 | 5 类食材完整 CRUD + 批量导入 + 统一分页 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页（BOM + 工艺）+ 创建向导 |
| 工作台 | ✅ 完成 | 模块入口总览 + 今日排程展示 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 采购管理 | ✅ 完成 | 采购单录入（AI识别+图片上传+未匹配标记+快速录入）/ 采购报销（创建+导出） |
| 库存管理 | ✅ 完成 | 实时库存（按二级分类筛选+采购频次）/ 库存台账（出入库记录+结算状态） |
| 排程管理 | ✅ 完成 | 排程创建（菜品选择器）/ 自动拆解切配工单+采购计划 / 状态流转 / 工作台展示 |

---

## 关键技术决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| Prisma Client 初始化 | `@prisma/adapter-pg` | Prisma 7 强制要求传入 adapter |
| 组件库 | 保持 shadcn/ui | 已深度集成，与 Next.js 16 / Tailwind v4 完全兼容 |
| 部署平台 | Zeabur | 支持 Next.js 自动检测，一键部署 |
| 数据库 | 复用同一套远程 PG | 本地开发与线上生产数据一致 |
| 编号生成 | 服务端自动生成 | 避免人工输入编号格式错误，保证唯一性 |
| BOM 表设计 | 5 张独立关联表 | 主料/辅料/净料/调料/酱料各一张，逻辑更清晰 |
| 图片存储 | Cloudinary Unsigned Upload | Zeabur 无状态容器不支持本地磁盘存储 |
| 库存模型 | 统一走原料库存 | 净料出库按出成率换算扣除对应原料；调料无映射不入库 |
| 结算状态 | 报销即视为结算 | 创建报销单后自动更新关联 ledger 记录 |
| 排程拆解 | 服务端事务内自动计算 | 保证数据一致性，前端只负责提交菜品清单 |
| 切配工单分类 | 一二级分类合并单元格 | 按厨房实际分类组织，便于切配人员按类领取 |

---

## 2026-06-08（Day 5）— 采购/库存/菜品档案全局优化

### 完成内容

**AI 识别服务**：
- 切换为通义千问 `qwen3.6-flash`（支持多模态图片输入）
- 采购单/出库单识别改为原生 `image_url` 方式，去掉 OCR 中间层
- 增强数据解析：兼容 Qwen 返回的带单位字符串（如 `"10斤"` → `qty: 10, unit: "斤"`）

**采购管理重构**：
- 采购单列表页：标准架构（PageHeader + 右侧二级菜单 + 操作按钮），筛选区单独一行
- 表格字段精简为：编号、采购日期（精确至时分）、摘要、总金额、负责人、创建时间、操作
- 新增详情弹窗（1400px 宽屏展示）：基本信息 + 采购明细清单表格
- 删除功能：未结算采购单可删除，已结算不可删除；删除时同步回滚库存 + 清理台账记录
- 新增 `DELETE /api/purchase-receipts/[id]` 接口
- 采购报销页：去掉返回按钮，作为独立二级页面

**库存管理重构**：
- 实时库存：去掉头部 3 个统计指标，一二级分类改为 tag 样式展示
- 库存台账：按采购单/出库单维度聚合展示（后端按 `source` 分组，关联采购单信息）
- 列表字段：类型、来源/摘要、日期、食材种数、总数量、结算状态、负责人、操作
- 明细弹窗展示该单所有食材的变动量、单位、结存

**用户表扩展**：
- `User` 模型新增 `role` 字段
- 更新用户数据：zhang→张浩/业务运营，yang→杨厨/厨房负责人

**菜品档案整体优化**：
- Dish 模型新增 `status` 字段（`draft`/`pending`/`published`）
- 创建向导扩展为 5 步：基本信息 → 主料辅料 → 小料酱料 → 调料 → 加工工艺
- BOM 添加改为搜索弹窗模式：模糊搜索 → 选中 → 输入用量(g)；搜索无结果可手动新增
- 发布校验：主料辅料 + 调料不能为空
- 存草稿：第 2 步及以后可随时保存草稿
- 列表页：一行 4 列卡片，状态/菜系/荤素/份量用 tag 展示，类别改为下拉筛选
- 详情页：头部显示状态 badge，支持发布/撤回操作
- 所有选择字段统一使用 `TileSelect`（参照原料表单二级分类交互样式）
- 表单控件大气化：`h-11 text-base px-4`

**全局页面架构统一**：
- 采购/库存 4 个二级页面：二级菜单 tab 和操作按钮统一靠右对齐
- 日期输入框统一增加 `h-11 cursor-pointer` 扩大触发范围

**新增/修改文件**：
- `app/components/dish-create-wizard.tsx` — 菜品创建向导组件（新）
- `app/components/tile-select.tsx` — TileSelect 选择组件（新）
- `app/components/select-field.tsx` — SelectField 组件（新）
- `app/api/dishes/[id]/route.ts` — 菜品详情/更新/删除
- `app/api/purchase-receipts/[id]/route.ts` — 采购单详情/删除
- `app/api/inventory/ledger/route.ts` — 台账聚合查询
- `lib/ai.ts` — 切换 Qwen 客户端
- `prisma/schema.prisma` — Dish 增加 status，User 增加 role

### 验证
- `npm run build` ✅ 构建成功（52 个路由）

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表 |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商 |
| 食材库 | ✅ 完成 | 5 类食材完整 CRUD + 批量导入 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页 + 5 步创建向导（草稿/发布）+ TileSelect 交互 |
| 工作台 | ✅ 完成 | 模块入口总览 + 今日排程展示 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 采购管理 | ✅ 完成 | AI 识别（Qwen）/ 采购单录入 + 详情弹窗 + 删除 / 报销管理 |
| 库存管理 | ✅ 完成 | 实时库存（tag 分类）/ 台账（采购单维度聚合） |
| 排程管理 | ✅ 完成 | 排程创建 / 自动拆解切配工单+采购计划 / 状态流转 |

---

## 关键技术决策记录

| 决策 | 方案 | 原因 |
|------|------|------|
| Prisma Client 初始化 | `@prisma/adapter-pg` | Prisma 7 强制要求传入 adapter |
| 组件库 | 保持 shadcn/ui | 已深度集成，与 Next.js 16 / Tailwind v4 完全兼容 |
| 部署平台 | Zeabur | 支持 Next.js 自动检测，一键部署 |
| 数据库 | 复用同一套远程 PG | 本地开发与线上生产数据一致 |
| 编号生成 | 服务端自动生成 | 避免人工输入编号格式错误，保证唯一性 |
| BOM 表设计 | 5 张独立关联表 | 主料/辅料/净料/调料/酱料各一张，逻辑更清晰 |
| 图片存储 | Cloudinary Unsigned Upload | Zeabur 无状态容器不支持本地磁盘存储 |
| 库存模型 | 统一走原料库存 | 净料出库按出成率换算扣除对应原料；调料无映射不入库 |
| 结算状态 | 报销即视为结算 | 创建报销单后自动更新关联 ledger 记录 |
| 排程拆解 | 服务端事务内自动计算 | 保证数据一致性，前端只负责提交菜品清单 |
| 切配工单分类 | 一二级分类合并单元格 | 按厨房实际分类组织，便于切配人员按类领取 |
| AI 识别 | 通义千问 qwen3.6-flash | DeepSeek V4 预览版不支持图片输入；Qwen 多模态稳定且便宜 |
| 单选交互规范 | ≤5 Tile 平铺 / >5 TileSelect 弹窗 | 选项少时一眼可见，选项多时支持搜索筛选 |

---

## 已知问题与 TODO
- [ ] **用户管理模块**：User 表已增加 `role` 字段，需开发用户管理页面（列表/新增/编辑/启用禁用），支持按角色分配菜单权限
- [ ] **全局单选组件规范**：≤5 个选项的 Radio/Tile 平铺展示，>5 个选项的使用 `TileSelect` 弹窗选择；需逐步在排程/采购等模块落地
- [ ] 用户认证与权限控制尚未设计
- [ ] 加工工艺 stage 当前为 `初加工/切配/烹饪/装盘`，与 Database.md 定义的 `初加工/预处理/上灶加工/出锅成品` 不一致
- [ ] Cloudinary 环境变量需在生产环境配置 `CLOUDINARY_CLOUD_NAME` 和 `CLOUDINARY_UPLOAD_PRESET`
