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
| 操作人展示 | 统一解析 username → name | 各业务列表/详情均展示真实姓名而非账号 |
| 字典入口 | 从 `/dictionaries` 合并到 `/settings` | 设置模块统一承载基础数据与个人配置 |

---

## 2026-06-12（Day 6）— 用户权限 + 设置模块重构 + 全局交互统一

### 上午：用户管理与权限基础

**角色体系落地**：
- 新增 `lib/roles.ts` 定义 4 个角色：`系统管理员` / `业务运营` / `厨师长` / `采购`
- 登录/会话/中间件全链路携带 `role`，API 通过 `getUserFromRequest` 读取

**用户管理 API**：
- `GET /api/users` — 列表（管理员权限）
- `POST /api/users` — 创建用户（bcrypt 哈希密码）
- `GET /api/users/[id]` / `PUT /api/users/[id]` / `DELETE /api/users/[id]` — 详情/更新/删除
- `PUT /api/users/profile` — 当前用户修改姓名、账号、密码（改账号后自动刷新 session）

**用户管理页面**：
- `app/settings/users/page.tsx` — 表格列表 + 搜索 + 新增/编辑弹窗 + 删除确认
- 禁止删除当前登录用户

### 下午：设置模块重构

**入口整合**：
- 侧边栏「字典」改为「设置」，原 `/dictionaries/*` 页面删除
- 新增 `/settings` 首页，卡片展示：菜品类别 / 食材分类 / 单位 / 供应商 / 用户管理
- 4 个字典页面迁移到 `/settings/categories` `/settings/classes` `/settings/units` `/settings/suppliers`
- 新增 `/settings/profile` 个人设置页
- `next.config.ts` 添加永久重定向：`/dictionaries/*` → `/settings/*`

**侧边栏优化**：
- 底部用户区改为可点击，跳转个人设置
- 显示用户角色 badge
- 导航标签加粗

### 下午：通用组件与表单交互升级

**日期选择器**：
- 新增 `app/components/date-picker.tsx`（基于 `react-day-picker` + `date-fns`）
- 采购单列表、报销页、排程列表等原生 `type="date"` 输入统一替换

**选择交互组件**：
- 新增 `TileGroup`：少量选项平铺单选（带 Check 图标）
- 新增 `UnitSelect`：从 `/api/units` 拉取单位，支持按 category 过滤
- `TileSelect` 增加 `searchable` 开关，分类选择关闭搜索更简洁
- `FormSection` 支持 `cols` 参数（1/2/3/4 列），原料表单改为 4 列紧凑布局

**食材表单改造**：
- 原料/净料/小料/调料/酱料 5 个页面：
  - 一二级分类选择改为 `TileSelect` 弹窗
  - 计量单位 / 计价单位改为 `UnitSelect` 或 `TileSelect`
  - 季节限定、储存方式等改为 `TileGroup` 平铺
- 列表页二级分类展示去掉 code 后缀

### 全局：操作人姓名展示优化

**后端**：
- 新增 `lib/user-resolve.ts`，提供 `enrichOperatorNames` 批量把 `operator` 账号解析为 `operatorName`
- 采购单、报销单、排程、菜品、库存台账等 GET API 统一接入

**前端**：
- 采购单列表/详情、报销列表/详情、排程详情、库存台账等展示 `operatorName || operator`

### 其他

- 新增 shadcn/ui 组件：`components/ui/calendar.tsx`、`components/ui/popover.tsx`
- 新增依赖：`date-fns`、`react-day-picker`
- `prisma/seed.ts` 调整用户角色：zhang→业务运营，yang→厨师长，新增 admin 系统管理员
- 中文用户名支持：中间件对 username 进行 URL encode/decode

### 验证
- `npm run build` ✅ 构建成功

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表 |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，迁移至设置模块 |
| 食材库 | ✅ 完成 | 5 类食材完整 CRUD + 批量导入 + TileSelect/TileGroup 交互升级 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页 + 5 步创建向导（草稿/发布）+ TileSelect 交互 |
| 工作台 | ✅ 完成 | 模块入口总览 + 今日排程展示 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 采购管理 | ⚠️ 基础完成 | 采购单录入（AI识别）/ 列表 / 详情弹窗 / 删除 / 报销管理；缺少采购计划执行、采购单编辑、供应商选择 |
| 库存管理 | ✅ 完成 | 实时库存 / 台账（采购单维度聚合） |
| 排程管理 | ✅ 完成 | 排程创建 / 自动拆解切配工单+采购计划 / 状态流转 |
| 用户权限 | ✅ 基础完成 | 角色字段 + 用户 CRUD + 个人设置 + 操作人姓名解析 |
| 系统设置 | ✅ 完成 | 字典迁移 + 个人设置 + 用户管理 |

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
| 操作人展示 | 统一解析 username → name | 各业务列表/详情均展示真实姓名而非账号 |
| 字典入口 | 从 `/dictionaries` 合并到 `/settings` | 设置模块统一承载基础数据与个人配置 |

---

## 已知问题与 TODO
- [ ] **采购计划执行**：排程中的采购计划仅支持填写 actualPurchase/actualAmount，未与采购单打通，需实现「按采购计划生成采购单」
- [ ] **采购单编辑**：当前采购单只能删除，不能修改明细、供应商、金额
- [ ] **供应商在采购流程中使用**：供应商字典已存在，但采购单录入时未选择供应商
- [ ] **采购对账/结算**：报销流程已存在，但缺少按供应商/时间段的汇总对账视图
- [ ] **加工工艺 stage 当前为 `初加工/切配/烹饪/装盘`，与 Database.md 定义的 `初加工/预处理/上灶加工/出锅成品` 不一致
- [ ] **Cloudinary 环境变量需在生产环境配置 `CLOUDINARY_CLOUD_NAME` 和 `CLOUDINARY_UPLOAD_PRESET`

---

# 明日开发计划（2026-06-13）— 采购模块闭环

## 目标
打通「排程采购计划 → 实际采购执行 → 采购单生成 → 采购单编辑 → 供应商对账」的完整链路，让采购从系统建议量真正落地为可结算的入库单据。

## 背景与现状
- 排程创建后会自动生成 `PurchasePlan`（采购计划），目前仅在排程详情页展示，可填写 `actualPurchase` / `actualAmount`，但数据未与采购单打通。
- 采购单录入页（`/purchases/new`）已支持 AI 识别和手动录入，但缺少供应商选择。
- 采购单列表支持查看详情弹窗、删除（未结算可删），但缺少编辑功能。
- 报销单已可关联多个采购单，但缺少按供应商/时间段的汇总对账视图。

## 任务拆解

### 任务 1：采购计划执行页

**路由**：`/schedules/[id]/purchase`
**触发入口**：排程详情页采购计划卡片右上角新增「执行采购」按钮

**页面功能**：
- 展示当前排程所有 `PurchasePlan`（按二级分类聚合）
- 每行可编辑：实际采购量、实际金额、供应商（从 `/api/suppliers` 选择）、备注
- 支持「全选/取消全选」批量生成采购单
- 按供应商自动分组：同一供应商的多个计划项合并为一张采购单
- 底部显示预计生成采购单数量、总金额汇总

**新增/修改文件**：
- `app/schedules/[id]/purchase/page.tsx` — 采购计划执行页
- `app/schedules/[id]/page.tsx` — 增加「执行采购」入口按钮

### 任务 2：采购计划执行 API

**路由**：`POST /api/schedules/[id]/execute-purchase`

**逻辑**：
- 仅允许 `待生效` / `进行中` 排程执行
- 接收执行项数组：`{ purchasePlanId, actualPurchase, actualAmount, supplierId?, remark? }`
- 按 `supplierId` 分组，每组生成一张 `PurchaseReceipt`
  - `receiptDate` = 当前日期
  - `summary` = `排程#${id} 采购执行`
  - `totalAmount` = 该组 `actualAmount` 合计
  - `operator` = 当前用户
- 每个计划项生成一条 `PurchaseReceiptItem`
  - `ingredientId`：根据 `sourceType` + `sourceId` 查找对应的 `Ingredient`
  - `itemName` = `PurchasePlan.itemName`
  - `qty` / `unitPrice` / `amount` = 实际采购量/单价/金额
  - `stockUnit` / `stockInQty` = 原料库存单位及换算后数量
- 同步更新对应 `PurchasePlan.status = "completed"`，回填 `actualPurchase` / `actualAmount`
- 事务内完成库存入库 + 台账写入（复用现有 `POST /api/purchase-receipts` 的入库逻辑，可抽成共享函数 `createReceiptAndStockIn`）

**新增/修改文件**：
- `app/api/schedules/[id]/execute-purchase/route.ts` — 执行采购 API
- `lib/purchase-utils.ts`（新建）— 抽取「创建采购单 + 入库 + 写台账」的共享事务函数，供 `POST /api/purchase-receipts` 和新 API 复用
- `app/api/purchase-receipts/route.ts` — 接入共享函数

### 任务 3：采购单编辑功能

**页面**：复用 `/purchases/new/page.tsx` 或在详情弹窗中增加编辑模式
**推荐方案**：在 `/purchases/new?page=edit&id=xxx` 或新建 `/purchases/[id]/edit/page.tsx`

**功能**：
- 仅允许编辑未结算采购单
- 加载原采购单数据：日期、供应商、摘要、明细（食材、规格、数量、单价、金额、入库数量）
- 编辑后重新计算 `totalAmount`
- 库存回滚：先按原明细扣减库存并删除原台账，再按新明细重新入库
- 关联报销单状态：若已被 `pending` 报销单引用，更新对应报销单的 `totalAmount` 和 `receiptIds`

**新增/修改文件**：
- `app/purchases/[id]/edit/page.tsx` — 编辑页（或改造 new 页面）
- `app/api/purchase-receipts/[id]/route.ts` — 增加 `PUT` 方法

### 任务 4：供应商选择贯穿采购流程

**涉及位置**：
- `/purchases/new` — 表头增加「供应商」下拉选择
- `/purchases/[id]/edit` — 同上
- `/schedules/[id]/purchase` — 计划项级别可选择供应商
- 采购单列表/详情展示供应商名称

**API 调整**：
- `GET /api/purchase-receipts` / `GET /api/purchase-receipts/[id]` — 返回 `supplier` 关联信息
- `POST /api/purchase-receipts` / `PUT /api/purchase-receipts/[id]` — 接收并保存 `supplierId`

### 任务 5：供应商对账视图（可选，视时间决定）

**路由**：`/purchases/reconciliation` 或在 `/purchases/reimbursements` 增加「按供应商汇总」Tab

**功能**：
- 选择时间范围 + 供应商
- 展示该供应商下所有未结算/已结算采购单
- 汇总：采购次数、采购总数量、采购总金额
- 一键生成报销单（复用现有报销创建逻辑）

**新增/修改文件**：
- `app/purchases/reconciliation/page.tsx`（可选）
- `app/api/purchase-receipts/reconciliation/route.ts`（可选）

## 数据流图

```
Schedule.purchasePlans
        │
        ▼
/schedules/[id]/purchase 填写实际采购量/金额/供应商
        │
        ▼
POST /api/schedules/[id]/execute-purchase
        │
        ├── 按 supplierId 分组
        ├── 生成 PurchaseReceipt + PurchaseReceiptItem
        ├── 更新 PurchasePlan.status = completed
        ├── 更新 Inventory + InventoryLedger
        │
        ▼
/purchases 列表查看 / /purchases/[id]/edit 修改
        │
        ▼
/purchases/reimbursements/new 生成报销单
```

## 验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 采购计划执行页可进入 | 从排程详情点击「执行采购」跳转，展示该排程所有采购计划 |
| 2 | 可填写实际采购信息 | 每行可填实际采购量、实际金额、选择供应商、备注 |
| 3 | 可生成采购单 | 点击「生成采购单」后按供应商分组生成多张采购单，并入库 |
| 4 | 采购计划状态更新 | 已执行的采购计划状态变为 `completed`，不可重复执行 |
| 5 | 采购单可编辑 | 未结算采购单可修改明细、供应商、摘要、金额，保存后库存/台账/报销金额正确回滚/更新 |
| 6 | 供应商展示 | 采购单列表、详情、编辑页正确展示供应商名称 |
| 7 | 构建通过 | `npm run build` 成功 |
| 8 | 端到端验证 | 创建排程 → 执行采购 → 查看采购单 → 编辑采购单 → 创建报销单，数据一致 |

## 预估工时

| 任务 | 工时 |
|------|------|
| 任务 1：采购计划执行页 | 3-4h |
| 任务 2：采购计划执行 API + 共享函数抽取 | 3-4h |
| 任务 3：采购单编辑功能（含 API） | 3-4h |
| 任务 4：供应商选择贯穿 | 1-2h |
| 任务 5：供应商对账视图（可选） | 2-3h |
| **合计** | **12-17h** |

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 采购计划单位与采购单入库单位换算复杂 | 中 | 中 | 统一以原料 `unit` 作为 `stockUnit`，采购单中记录 `qty`（采购单位）和 `stockInQty`（库存单位），两单位不同时需换算 |
| 编辑采购单时库存回滚导致负库存 | 中 | 高 | 回滚前校验 `currentQty >= stockInQty`，不足时拒绝编辑并提示 |
| 编辑影响已结算报销单 | 低 | 高 | 已结算采购单禁止编辑；pending 报销单编辑后需同步 `totalAmount` |
| 多供应商分组逻辑复杂 | 低 | 中 | 前端按 supplierId 分组展示，后端接收扁平数组后重新分组 |

## 优先级建议

**P0（必须完成）**：任务 1、2、3、4
**P1（建议完成）**：任务 5

如果当天时间紧张，可放弃任务 5，先确保「排程采购计划 → 采购单 → 编辑 → 报销」主链路闭环。
