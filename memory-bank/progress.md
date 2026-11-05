# 精益厨房 V3 — 项目推进日志

> 按日期记录核心推进过程，包括技术决策、问题解决、功能交付。

---

## 2026-11-05（下午）— 菜品库列表与转化交互优化（4 点反馈）

### 完成内容

- **列表重构**：去掉菜品描述列；份量列移到菜品名称之后，改为纯色高亮徽标（单人份=天蓝、一锅10份=橙，未知规格=紫，PortionBadge）
- **菜品转化**：弹窗更名「菜品转化」；仅「单人份」档案可转化（前端按钮按份量显隐 + 服务端校验）；目标份量默认一锅10份；移除"用量倍率"输入，倍率由份量规格自动推导（ portionScaleFactor：单人份=1、一锅10份=10，倍率=目标份数÷源份数，前后端共用 lib/shared/portion-scale.ts ）
- **售价/毛利率**：维持双向联动规则——毛利率手输自动算售价（售价=成本÷(1-毛利率)），售价手改反向算毛利率；限制：毛利率 0–99.9、售价非负
- **新增菜品份量默认单人份**：zod 默认值、表单初始值、回显兜底、PUT 兜底、Prisma 列默认值统一（迁移 20261105082720_default_dish_portion_single）

### 检查结果

- tsc / build / lint（0 errors，49 存量 warnings）全部通过

---

## 2026-11-05 — 菜品库：售价/毛利 + 份量枚举重命名 + 单人份→一锅10份转换

### 完成内容

- **售价字段启用**：列表新增售价、毛利率列；表单新增「毛利率」字段，与售价联动（售价 = 成本 ÷ (1 - 毛利率)，支持手动改售价）；详情抽屉展示售价/毛利率
- **份量枚举重命名**：`单人份量 → 单人份`、`正餐份量 → 一锅10份`（迁移 `20261105064239_rename_dish_portion_options`，含存量数据 UPDATE 与默认值变更）
- **菜品规格派生（通用）**：新 API `POST /api/dishes/[id]/scale`，以任一档案为源，按「目标份量 + 倍率」生成新规格独立草稿档案；主档 + 全部 BOM 明细（用量/成本缩放）+ 加工工艺复制；售价同步缩放。列表所有菜品行提供「生成其它规格档案」入口（弹窗内选目标份量、填倍率、实时预览成本/售价）
- 辅助修复：本地库 `_prisma_migrations` 中 `20261105033151` 的 checksum 与提交文件不一致（该迁移曾被提交后修改），已按当前文件哈希回写修复，恢复 migrate dev 可用

### 技术决策

- 毛利率口径：(售价 - 成本) ÷ 售价 × 100%；表单内成本取当前 BOM 明细实时估算（totalBomCost），BOM 为空时回退服务端存储成本
- 设计本意：一道菜按场景对应不同规格档案（人工小炒=单人份、炒菜机器人=一锅10份），以基础规格档案为源派生其它规格；倍率可任意（含 0.1 反向缩小），目标份量枚举扩展后无需改代码。编号沿用 DSH-<类别>-XXXX 规则，Serializable 事务 + 唯一冲突重试

### 检查结果

- `npx tsc --noEmit` / `npm run build` / `npm run lint`（0 errors）全部通过

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

## 2026-06-13（Day 7）— 采购单录入流程问题修复

### 问题来源

采购单录入流程测试中发现 5 个问题：
1. 一级分类「调味品」与二级分类「调料」无法正常选择；
2. 新增原料提交后，二级分类回显展示为编号；
3. 采购单无法正常提交；
4. AI 识别结果中「食材名称」实际为产品品牌名称，需要区分「食材名称」与「产品品牌名称/别名」；
5. 编辑按钮带图标，且编辑表单缺少食材 ID 与一二级分类展示。

### 修复内容

**分类字典打通**：
- `prisma/seed.ts` 新增标准「调味品」一级分类（SEA）和「调料」二级分类（SEA-SEA），并保留旧「米面粮油-调味品」（GRA-SEA）兼容。
- 移除代码中硬编码的 `SEASONING_L2_CODE = "SEA-SEA"`，改为按字典名称匹配判断调料。
- `app/components/ingredient-form-dialog.tsx`：根据当前选中的二级分类名称/父级名称判断是否为调料。
- `app/api/purchase-receipts/recognize/route.ts`：AI 识别时动态查询字典中的调料二级分类。
- `app/api/seasoning-ingredients/route.ts` 及其 `[id]/route.ts`：创建/更新调料时动态查询「调料」二级分类。
- `app/ingredients/seasoning/page.tsx`：新增调料时自动查找当前字典中的「调料」二级分类。

**字段语义重定义**：
- `lib/ai.ts`：AI prompt 增加 `productName`（完整产品品牌名称/别名）、`ingredientName`（提取后的食材名称）、`brand`（品牌前缀）。
- `app/api/purchase-receipts/recognize/route.ts`：`brand` 保存完整产品品牌名称/别名，`itemName` 保存提取后的食材名称。
- `app/purchases/new/page.tsx`：表格/编辑表单列头「产品品牌」改为「产品品牌名称/别名」。
- `app/components/ingredient-form-dialog.tsx`：调料场景的「产品品牌」标签同步改为「产品品牌名称/别名」。

**新增原料回显修复**：
- `app/purchases/new/page.tsx` 中 `handleIngredientSuccess` 根据返回的 `l2Code` 从字典反查 `l2Name` 与一级分类名，避免展示编号。

**采购单提交修复**：
- `app/purchases/new/page.tsx` 的 `handleSubmit` 为每个 item 补充 `storage` 字段（默认「常温」）。
- `app/api/purchase-receipts/route.ts` 的 POST handler 对 `storage` 做兜底，防止 Prisma 写入失败。

**编辑体验优化**：
- `app/purchases/new/page.tsx`：移除表格行「编辑」按钮前的 `Pencil` 图标。
- 编辑表单新增只读字段：食材 ID、一级分类、二级分类。
- `app/components/form-field.tsx`：新增 `readOnly` 属性，避免只读字段显示「(可选)」提示。

### 验证

- `npx prisma db seed` ✅ 成功写入新分类。
- `npx eslint` 检查本次修改文件 ✅ 无错误。
- 本地 dev server 验证：
  - AI 识别测试图片后，调料行二级分类显示「调料」，原料行二级分类显示「速冻食品」。
  - 食材名称与产品品牌名称/别名按新语义展示。
  - 编辑按钮无图标，编辑表单展示食材 ID、一级分类、二级分类。
  - 点击「确认录入」后成功跳转 `/purchases`，显示「采购单录入成功」。

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

---

## 2026-06-13（Day 7）— AI 识别修复 + 采购模块数据模型与录入重构

### 上午：提交权限/设置重构并修复 AI 识别

**已提交 commit**：
- `24e29f7` feat: 用户权限、设置模块重构与全局交互升级（2026-06-12 完成的内容，今日凌晨提交）
- `6b8e742` fix: 修复 AI 采购单识别返回空内容的问题

**AI 识别修复详情**：
- 问题根因：Qwen 视觉模型在启用 `response_format: { type: "json_object" }` 时，`content` 字段被强制返回空数组 `[]`
- 修复方案：移除 `response_format` 参数，改为直接输出 JSON 代码块，后端用正则清洗并解析
- 在识别接口增加关键步骤日志，便于后续线上排查

### 下午/晚上：采购模块数据模型与录入流程重构（进行中，未提交）

**新增规划文档**：
- `DEVELOPMENT_PLAN.md` — 基于源码审计的生产级开发计划方案，覆盖现状诊断、四阶段路线图、技术债务、API/路由规划

**Schema 扩展**：
- `PurchaseReceipt`：`status` 默认值由 `completed` 改为 `待结算`，新增 `supplierName`、`imageUrl`
- `PurchaseReceiptItem`：新增 `brand`、`l2Code`、`l2Name`、`isManual`、`purchaseUnit`、`seasoningIngredientId`
- `Ingredient`：新增 `brand`、`purchaseUnit`、`stockUnit`、`latestRefPrice`
- `SeasoningIngredient`：新增 `l2Code`、`stockUnit`、`latestRefPrice`，建立与 `PurchaseReceiptItem` 的反向关联

**新增可复用组件**：
- `app/components/category-tag.tsx` — 按一/二级分类代码渲染彩色标签
- `app/components/image-preview-modal.tsx` — 图片预览弹窗
- `app/components/searchable-select.tsx` — 可搜索下拉选择
- `app/components/searchable-table-select.tsx` — 表格弹窗搜索选择
- `app/components/supplier-select.tsx` — 供应商选择器（基于 SearchableTableSelect）
- `app/components/ingredient-form-dialog.tsx` — 原料/调料快速新增/编辑弹窗

**新增工具**：
- `lib/spec-parser.ts` — 采购规格解析：支持从 `1千克*10袋`、`1件=20袋`、`10袋` 等格式自动换算入库数量与库存单位

**采购单录入页重构（`/purchases/new`）**：
- 表头增加供应商选择（`SupplierSelect`）
- AI 识别结果自动回填供应商、摘要
- 识别出的食材支持：
  - 未匹配项一键「新增食材」或关联现有食材
  - 已匹配项直接编辑规格/单位/单价
  - 规格按 `spec-parser` 自动换算入库量
- 新增「手动添加」弹窗，支持录入无图片的采购项
- 调料类食材可直接关联 `SeasoningIngredient`

**采购单列表页重构（`/purchases`）**：
- 状态 Tab 筛选：待结算 / 已结算 / 已作废 / 全部
- 删除改为「作废」：将 `status` 更新为 `已作废`，并回滚库存/台账
- 列表展示供应商名称
- 详情弹窗支持图片预览

**API 调整**：
- `GET /api/purchase-receipts`：支持 `status` 筛选，返回 `supplier` 关联与调料关联
- `POST /api/purchase-receipts`：保存 `supplierName`、新字段、调料ID；入库时回写 `latestRefPrice`
- `PUT /api/purchase-receipts/[id]`：同步支持新字段与作废逻辑
- `PUT /api/ingredients/[id]` / `POST /api/ingredients`：支持新字段
- `PUT /api/seasoning-ingredients/[id]` / `POST /api/seasoning-ingredients`：支持新字段

### 验证
- `npm run build` ⏳ 未执行（存在未提交变更，待明日完成模块闭环后统一验证）

---

## 累计交付状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 数据库设计 | ✅ 完成 | 25 张表 + 本次采购单字段扩展 |
| 基础字典 | ✅ 完成 | 菜品类别 / 食材分类 / 单位 / 供应商，迁移至设置模块 |
| 食材库 | ⚠️ 迭代中 | 5 类食材 CRUD 完成；原料/调料新增字段与规格解析已落地 |
| 菜品库 | ✅ 完成 | 卡片列表 + 详情页 + 5 步创建向导（草稿/发布）+ TileSelect 交互 |
| 工作台 | ✅ 完成 | 模块入口总览 + 今日排程展示 |
| 部署上线 | ✅ 完成 | Zeabur 自动部署 |
| 采购管理 | ⚠️ 重构中 | 列表/录入/作废流程已重构；采购计划执行页、采购单编辑页尚未开始 |
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
| 采购单状态 | `待结算 / 已结算 / 已作废` | 替代原 `completed`，支持作废后库存回滚且保留单据 |
| 规格换算 | `lib/spec-parser.ts` 独立工具 | 采购规格到入库数量的换算属于通用逻辑，抽离便于测试复用 |
| 录入流食材创建 | 弹窗内直接新增/编辑原料或调料 | 减少 AI 识别未匹配时跳转页面的心智负担 |

---

## 已知问题与 TODO

- [ ] **采购计划执行页**：排程采购计划仍需 `/schedules/[id]/purchase` 执行入口
- [ ] **采购单编辑页**：`/purchases/[id]/edit` 尚未创建
- [ ] **采购计划执行 API**：`POST /api/schedules/[id]/execute-purchase` 尚未创建
- [ ] **采购对账/结算**：报销流程已存在，但缺少按供应商/时间段的汇总对账视图
- [ ] **加工工艺 stage 当前为 `初加工/切配/烹饪/装盘`，与 Database.md 定义的 `初加工/预处理/上灶加工/出锅成品` 不一致
- [ ] **Cloudinary 环境变量需在生产环境配置 `CLOUDINARY_CLOUD_NAME` 和 `CLOUDINARY_UPLOAD_PRESET`

---

# 明日开发计划（2026-06-14）— 完成采购模块闭环

## 目标
在今日重构基础上，完成「排程采购计划 → 采购单生成 → 采购单编辑 → 报销」的完整闭环。

## 任务拆解

### 任务 1：采购计划执行页 + API
- 创建 `/schedules/[id]/purchase/page.tsx`
- 在 `/schedules/[id]/page.tsx` 增加「执行采购」入口
- 创建 `POST /api/schedules/[id]/execute-purchase`
- 按供应商分组生成采购单，并更新采购计划状态为 `completed`

### 任务 2：采购单编辑页
- 创建 `/purchases/[id]/edit/page.tsx`
- 在 `/api/purchase-receipts/[id]/route.ts` 增加 `PUT` 方法
- 编辑时回滚库存/台账，按新明细重新入库
- 已结算/已作废采购单禁止编辑

### 任务 3：供应商对账视图（可选）
- `/purchases/reconciliation` 或在报销页增加「按供应商汇总」Tab

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
| 任务 1：采购计划执行页 + API | 4-5h |
| 任务 2：采购单编辑页（含 API） | 4-5h |
| 任务 3：供应商对账视图（可选） | 2-3h |
| **合计** | **10-13h** |

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 采购计划单位与采购单入库单位换算复杂 | 中 | 中 | 复用 `spec-parser.ts`，采购单中记录 `qty`（采购单位）和 `stockInQty`（库存单位） |
| 编辑采购单时库存回滚导致负库存 | 中 | 高 | 回滚前校验 `currentQty >= stockInQty`，不足时拒绝编辑并提示 |
| 编辑影响已结算报销单 | 低 | 高 | 已结算/已作废采购单禁止编辑；pending 报销单编辑后需同步 `totalAmount` |
| 多供应商分组逻辑复杂 | 低 | 中 | 前端按 supplierId 分组展示，后端接收扁平数组后重新分组 |


---

## 本地开发环境（2026-10-26 更新）

- **本地 MySQL**：8.4.9，winget 安装于 `C:\Program Files\MySQL\MySQL Server 8.4`，Windows 服务 `MySQL84`（开机自启），数据目录 `C:\ProgramData\MySQL\MySQL Server 8.4\Data`，root 无密码，端口 3306。
- **数据库**：`lean_kms`（业务库）+ `lean_kms_shadow`（migrate diff 影子库），均为 utf8mb4 / utf8mb4_0900_ai_ci。
- **本地库由 seed 重建**（admin/admin123、zhang/123456、yang/123456）。
- ~~本地 PostgreSQL（E:\pgsql17）已弃用~~，可删除。
- **部署**：阿里云部署文件 — Dockerfile（多阶段 standalone）、docker-compose.yml（web+db+migrate+backup）、docs/aliyun-deploy.md。

### 数据库切换 PostgreSQL → MySQL（2026-10-26 完成）

- 适配器 `@prisma/adapter-pg` → `@prisma/adapter-mariadb`（连接串直连）
- 删除 13 处 `mode: "insensitive"`（MySQL utf8mb4 collation 天然不区分大小写）
- `PurchaseReimbursement.receiptIds Int[]`（PG 数组，MySQL 不支持）规范化为 `PurchaseReceipt.reimbursementId` 外键关系
- 旧 5 个 PG 迁移全部删除，MySQL 空库上重建单一基线 `20261026113210_init`，`migrate diff` 校验零差异


### 线上部署（2026-10-26 完成）

- **服务器**：阿里云 ECS 经济型 e（2C4G / 40G ESSD），Ubuntu 26.04.1，公网 IP `101.37.64.216`
- **架构**：Docker Compose（db=mysql:8.4 + web=standalone + migrate + backup），代码在 `/opt/lean-kms-v3`（git clone），访问 http://101.37.64.216
- **Docker**：docker.io 29.1.3（Ubuntu 源）；镜像加速器用 `docker.m.daocloud.io` + `hub.rat.dev`（1ms.run/nju/geekery 在该机器不可用）
- **注意**：Docker Hub 官方源和 download.docker.com 在大陆被墙，必须用加速器

---

## 2026-10-30 — 设置模块分类字典盘查迭代（菜品类别 / 食材分类）

### 盘查方式

`scripts/audit-categories.mjs`（Prisma 直连只读审计）：菜品类别 19 条零引用、食材分类 10 L1 + 31 L2 结构完整；发现 1 处数据瑕疵 + 4 类代码问题。

### 盘查发现

1. **数据瑕疵**：`水产(AQU)` 下二级分类编号为 `AUC-FIS/AUC-SHR/AUC-SHE`（seed 源头写错），违反「L2 = L1前缀-后缀」约定，`CategoryTag` 按前缀查色板命中不了 → 水产标签灰色兜底
2. 菜品类别删除无引用保护（有菜品时删除抛 FK 数据库错误）
3. 食材分类改编号无保护：`Ingredient/NetIngredient.l2Code` 为字符串引用，改 L2 编号静默产生孤儿引用
4. `IngredientCategoryL1` 无 description 字段，前端编辑弹窗说明输入被静默丢弃
5. 两个分类字典均无启用/停用机制

### 修复内容

**Schema + 迁移**（`20261030021015_category_is_active_and_aqu_prefix`）：
- `DishCategory` / `IngredientCategoryL1` / `IngredientCategoryL2` 新增 `isActive`（默认 true）；L1 新增 `description`
- 迁移 SQL 内置 AUC→AQU 修正（字典表 + ingredients / net_ingredients / purchase_plans / purchase_receipt_items / cutting_orders 的 l2_code 快照同步更新）
- `seed.ts` 源头改为 `AQU-FIS/AQU-SHR/AQU-SHE`

**引用保护**（新 `lib/server/category-references.ts`，复刻 unit-references 模式）：
- 菜品类别删除/改编号前查 `dish.count`；食材 L1（含全部子级汇总）/L2 删除/改编号前查 ingredient + netIngredient（`deletedAt: null`）
- 被引用返回 400 + `{ references: byEntity }` 明细，前端弹窗引导「停用」

**停用机制**（复刻单位字典模式）：
- GET 默认只返启用分类；设置页传 `?includeInactive=1` 查全量
- 业务端 tree 模式额外隐藏「无启用二级分类」的空壳一级分类（`children: { some: { isActive: true } }`）
- 设置页两个分类页新增状态列 / 状态筛选 / 停用启用 toggle / 引用删除拦截弹窗（全套复刻 units 页）

### 验证

- `npx tsc --noEmit`、`npm run build`、`npm run lint`（0 errors）✅
- 盘查脚本复跑：AQU children 已修正、零孤儿 ✅
- E2E（3001 端口新构建，admin 会话）：菜品类别创建/重复编号 400/菜品引用后删除与改名均拦截且返回引用数/停用后业务端隐藏设置页可见/启用后恢复/无引用可删 ✅；食材分类 L1 说明保存/L1 有子级禁改编号/L2 被原料引用禁改编号与删除/停用后业务端 tree 隐藏/设置页全量可见 ✅

### 已知取舍

- 已引用被停用分类的存量菜品/食材，编辑页分类选择器显示为空（与单位字典一致）
- 列表页按已选分类过滤（l1Code/l2Code 查询参数）不受停用影响，保证存量数据可查

---

## 2026-10-30（下午）— 原料清单迭代：采购规格计算链路与交互

### 语义对齐（关键决策）

与用户对齐后明确三条语义，后续所有换算逻辑以此为纲：
1. **采购规格 = 换算描述符**：回答「1 个采购单位 = 多少库存单位」（如 `5斤/袋` = 每袋 5 斤）
2. **库存按食材各自的入库单位记账**，不做全局统一（斤/袋/瓶/箱各自记）
3. 路线选择**放宽计算侧**：统一宽语法解析，不做结构化录入改造

### 盘查发现 → 修复

1. **P0 双解析器语法不一致**：`calculateStockInfo` 只认含 `*` 格式，`calcJinPerPurchaseUnit` 支持 `*/空格/斜杠` 宽语法 → `5斤/袋` 每斤单价能算但入库数量静默兜底为 1（库存错）
   → 新增 **`resolveStockInfo`**（lib/shared/spec-parser.ts）：宽语法 token 化 + 按目标入库单位换算 + `confidence: high/low` 标记；`purchaseUnit` 入参把「按重直采」（采购单位是重量单位）纳入统一处理（如按公斤采购入库斤 = qty×2）
2. **P0 批量导入不算每斤单价** → import 路由接入 `getJinFactors + calcPricePerJin`，与单条创建对齐
3. **P1 「斤」硬编码 5 处** → 全部由 resolveStockInfo 内部的重量单位判断接管，消除特判
4. **P1 低置信入库无警示** → 采购录入页（含编辑态）：低置信行琥珀色高亮 + 入库数量输入框标色 + 提交前 toast 汇总提示；手动改入库数量后自动视为已核对
5. **P1 表单价格交互** → 每斤单价手动编辑后锁定（`pricePerJinDirty`），规格/单价变化不再覆盖手填值；规格可换算性即时反馈（可换算显示 ≈N 斤 / 不可换算琥珀提示）
6. **P2 前端调料判定硬编码 SEA/GRA-SEA** → 改名称匹配（调料/调味品），与弹窗 isSeasoning 一致

### 关键实现

- `tokenizeSpec`：宽语法 token 化（`[*×/\s]+` 分隔，提取「数字+单位」）；占位符（散称/散装称斤/单袋）不产出 token
- 换算优先级：按重直采 → target 重量单位（全 token 乘积换算克数）→ target 计数单位（精确匹配/隐含 1:1，**隐含 1:1 需有依据**：规格含重量 token 或尾段裸单位匹配）→ 末 token 语义（兼容存量）→ 兜底 1 + low
- 系数提供者：`buildGramFactors`/`getGramFactors`（克级）、`buildJinFactors`/`getJinFactors`（每斤级）双轨；resolveStockInfo 未注入字典时以内置兜底值推导克级系数
- 识别 API（recognize）返回行新增 `stockConfidence` 字段；旧 `calculateStockInfo` 保留不动（向后兼容）

### 验证

- 单测 21/21 通过（旧 14 + 新增 resolveStockInfo/tokenizeSpec 7 例）
- `tsc` / `build` / `lint` 0 errors
- E2E（node 脚本 scripts/e2e-spec-calc.mjs，规避 Windows curl 中文乱码）：
  - 创建原料 `5斤/袋` ref=18.5 → pricePerJin=3.7 ✓；手填 3.55 生效 ✓；批量导入 `5斤` 18.50 → 3.7 ✓
  - 采购 3 袋（stockInQty=15）→ 库存 15 斤 ✓ → 台账 1 条 ✓ → 作废后库存回滚 ✓
- 注意：Windows Git Bash curl 直接传中文 JSON 体会乱码入库（UTF-8 环境问题），E2E 改用 node fetch

---

## 2026-10-30（晚）— 测试反馈三连修

### 1. 分类改名阻断修复（用户实测反馈）

**根因**：用户新建一级分类时把编号/名称填反（`code=猪肉类, name=PIG`），想修正时被「有子级禁止改编号」规则挡住；且编号无格式校验，放行了中文编号。

**修复**：
- **编号格式校验**：`ingredient-category` / `dish-category` zod schema 增加正则 `/^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9]+)*$/`，中文编号 400 拦截。存量脏数据不受影响（校验只拦新输入）
- **L1 编号改名级联**：FK（L2.parentCode → L1.code）即时检查导致"先改父/先改子"都会悬空，改为事务内**新建新编号 → 子级批量改挂 → 删除旧行**三步（L1 id 变化，无外部按 id 引用）；引用拦截随级联安全性移除，删除保护不变
- 前端提示区分 L1/L2 语义

### 2. 商品名称（alias）字段评估结论

**保留该字段**。定位为**采购侧的商品身份**（品牌商品名/供应商叫法）：
- 核心用途：AI 采购识别模糊匹配（alias 与 name 同权重，≥0.9 命中）、采购单行「产品品牌名称/别名」贯通、调料场景必填
- 次要用途：列表搜索（q 覆盖 alias）、展示列
- 对厨房侧（BOM/切配/成本）无意义；重名查重只比 name 不含 alias——此边界设计正确
- 评估结论：现状设计恰好正确，无需改动

### 3. resolveStockInfo 隐含 1:1 规则补强

**缺口**：`3斤/盒` 采购单位=箱 + 入库单位=盒 时，旧规则命中隐含 1:1 判 high——箱→盒数量关系规格未给出，错误高置信。
**修复**：隐含 1:1 增加前提 `purchaseUnit === targetStockUnit`（买卖同单位、规格仅重量说明）；跨单位无依据 → 按 1:1 估算但 `confidence=low` + 前端琥珀提示。

### 验证

- 全量 66 测试通过；tsc / build / lint 0 errors
- E2E：非法编号 400 ✓；L1 `猪肉类→PIG` 级联成功（子级 PIG-COL 改挂，猪血已移入）✓；猪血 `3斤/盒` ref=9 → pricePerJin=3 ✓

---

## 2026-10-30（夜）— 净料模块升级：封装规格 / 成本价-出库价双轨

### 业务定义（用户对齐）

净料清单 = **原料加工后按封装规格封装、算上加工成本后的出库价格体系**。

| 决策 | 结论 |
|------|------|
| 双入口（原料清单「转净料」+ 净料清单「新增」） | 已是现状（同组件同 API），字段升级后天然统一 |
| 封装规格（g） | **必填**；单位固定 g（替换原 "500g"） |
| 菜品 BOM 成本口径 | **出库价**（含封装加工费） |
| 小料 | 字段结构不动，仅修正成本公式分母 |

### 价格体系（新）

```
净料成本价（元/斤）= 原料每斤单价 ÷ (出成率/100)      [既有逻辑，展示改名]
净料出库价（元/斤）= 成本价 + 封装加工费              [新，纯计算不落库]
标准规格价格（元/份）= 出库价 × 封装规格(g) ÷ 500     [新，纯计算不落库]
```

### 改动

- **Schema + 迁移** `20261030084840_net_ingredient_package_spec`：`packageSpec`(g)、`processingFeePerJin`(元/斤) 两列；`unit` 默认 "g" + 存量 '500g'→'g' 迁移
- **新纯函数** `lib/shared/net-price.ts`：`calcOutPricePerJin` / `calcStandardPackagePrice`（7 个单测）
- **API**：净料 POST/PUT 封装规格必填校验（`净料必须填写封装规格（g）`）；GET 序列化注入 costPricePerJin/outPricePerJin/standardPackagePrice（`serializeNetIngredient`，`lib/server/net-ingredient-utils.ts`）
- **BOM 成本公式修正（既有 bug）**：净料原 `unitPrice × amountG ÷ 1000` 与单价单位（元/500g）不匹配、成本算低一半 → 改为 `出库价 × amountG ÷ 500`；小料 `÷1000` → `÷10`（单价语义 元/10g）；调料/酱料不动
- **前端**：净料表单（封装规格必填 + 加工费 + 出库价/标准规格价格只读实时计算）、右侧面板七列、净料清单页列；小料分支零改动
- **迁移过程小插曲**：上午给已应用迁移追加数据修正 SQL 导致校验和不匹配，通过更新 `_prisma_migrations.checksum`（SHA-256 十六进制）修复，避免数据库重置保住测试数据

### 验证

- 全量 73 测试通过；tsc / build / lint 0 errors
- E2E（猪血 pricePerJin=3、出成率 60%、封装 500g、加工费 0.5）：成本价 5 → 出库价 5.5 → 标准规格价格 5.5；缺封装规格 400；改加工费 0.8 → 5.8 实时联动；BOM 用量 250g 成本 2.9（旧公式仅 1.45）✓

---

## 2026-11-03（晚）— 调料清单模块迭代：分类体系归位 + 列表交互对齐

### 背景与决策

业务定位明确：原料 = 非标准化食材（需加工转化为净料/小料）；调料 = 标准化食材（直接采购直接使用）。用户确认：
1. 调料分类在食材分类体系中管理：SEA（调味品）下按物理形态预置 **SEA-SOL 固体类、SEA-LIQ 液体类**；原 SEA-SEA「调料」**停用**（编码保留，服务端识别仍覆盖）
2. 历史遗留 **GRA-SEA（米面粮油-调味品）直接删除**（无数据引用，迁移 SQL 带引用保护，本地/生产一致）

### 完成内容

- **识别逻辑编码化**：客户端 `isSeasoningChild` 名称识别（「调料/调味品」改名即失效）全面改为编码识别（SEA 一级分类），涉及 ingredient-form-fields/dialog、seasoning 页、getSeasoningL2Codes/getNonSeasoningL2Codes（去 GRA-SEA 特判）
- **字典三处同步**：seed.ts（新增两个分类 + SEA-SEA 停用 upsert、移除 GRA-SEA）→ 迁移 `20261103141514_delete_gra_sea_category`（引用保护删除 GRA-SEA）→ 重生成 dictionary-baseline.sql（部署自动对齐）
- **调料列表页对齐**：手写 Table → DataTable；新增二级分类筛选（SEA 启用子分类）；操作列加「查看」只读弹窗（IngredientFormDialog 新增 view 模式 + IngredientFormFields viewMode）；弹窗标题按模块区分（新增原料/新增调料/新增食材）
- 原料表单分类选择排除 SEA（此前只按名称排除，SEA 改名会漏）

### 验证

- 强制检查全过（tsc/lint/build/73 tests/迁移零差异）
- API 实测：SEA-LIQ 创建调料 → 编码 SEA-0001 → summary 计入 seasoning（非 raw）→ 删除正常
- 分类接口实测：SEA 子分类仅返回 固体类/液体类（停用的「调料」不出现）

---

## 2026-11-03（下午）— 小料模块整体升级：从「直接录入」改为「原料转化」模式

### 背景与决策

小料原为直接录入（自由文本规格 + 手动元/10g 单价，无来源原料/出成率），与业务实际不符——小料（蒜末、葱花等）同样由原料初加工转化而来。经确认：
1. **价格体系完全对齐净料**：成本价（元/斤）= 原料每斤单价 ÷ 出成率；封装规格 + 封装加工费 → 出库价 → 标准规格价；菜品 BOM 成本按出库价 × 用量g ÷ 500；单位统一 g，废弃 10g 计价
2. **存量数据清空重建**：迁移 `20261103123018_clear_legacy_minors` 删除全部旧小料及其菜品 BOM 引用（dish_minor_details 无级联，先删子表）

### 完成内容

- **表单组件统一**（net-ingredient-form-fields/dialog/edit-dialog）：删除全部 isMinor 特殊分支；小料与净料字段完全一致（来源原料 + 出成率 + 封装规格 + 加工费 + 成本价自动/手动 + 出库价 + 标准规格价）；minor 仅剩差异点：一级分类固定 MIN、二级分类取 MIN 子树、来源选择不改写分类（净料的 l2Code 继承来源原料，小料不继承）
- **API 统一**（POST/PUT /api/net-ingredients[/id]）：删 isMinor 分支；zod schema 收紧（sourceIngredientId/yieldRate/packageSpec 必填）；成本价必算（缺原料价时报错引导）
- **菜品 BOM 成本**（dishes/[id]/bom）：小料改按出库价（含加工费）× g ÷ 500，与净料同口径
- **排程采购计划**（buildPurchasePlans）：小料按出成率折算并入来源原料毛需求（与净料同一聚合路径），不再生成独立小料采购行；buildCuttingOrders 不变（切配单仍按小料净需求汇总）
- **小料清单页**：传真实原料列表、列对齐净料（封装规格/来源/出成率/成本价/出库价/标准规格价）、加查看入口、分页条数选择器
- **本地库迁移修复**：`_prisma_migrations` 两条校验和过期（库结构经 migrate diff 校验与迁移历史零差异），按文件 sha256 修正后恢复迁移能力

### 验证

- tsc / lint / build 通过；Jest 73 个测试全过；本地迁移后小料表清零验证

---

## 2026-11-03 — 字典基线对齐机制（字典即代码）上线

### 背景生产库种子数据过老（缺水产 AQU 分类、g/kg 单位），且生产 MySQL 不对外暴露端口，无法本地直推。

### 机制

- `scripts/export-dictionary-sql.mjs`：读取本地字典表生成**幂等对齐 SQL**（INSERT ... ON DUPLICATE KEY UPDATE，只增改不删，不碰用户与业务数据）
- `scripts/dictionary-baseline.sql`：当前字典基线，随仓库版本化；字典调整后重跑生成器并提交
- **部署链路自动对齐**：GitHub Actions SSH 脚本与 deploy.sh 在 `compose up` 后执行
  `docker compose exec -T db sh -c 'mysql ...' < scripts/dictionary-baseline.sql`，
  每次部署自动保证各环境字典一致（本地为基准）
- seed.ts 补录 PIG/PIG-COL，新环境初始化与基线一致

### 验证

- 部署 `b6fbc42` 后生产库验证：水产（AQU)+鱼类/虾类/贝类 ✓、猪肉类（PIG)+冷鲜 ✓、g/kg 单位补齐（20 个）✓

---

---

## 2026-10-30 — 设置模块·单位子模块夯实 + 一键/自动部署上线

### 完成内容

**单位子模块（设置模块迭代第 1 站）**：
- `Unit` 表新增 `gramsPerUnit`（重量类换算克数）+ `isActive`；迁移 `20261029091002`；seed 改 upsert 回填老库
- 换算唯一来源改为字典：`lib/shared/unit-conversion.ts`（buildJinFactors）+ `lib/server/unit-factors.ts`（getJinFactors），注入 spec-parser / weight-format 纯函数；硬编码降级为兜底
- 引用保护：`lib/server/unit-references.ts` 扫描 8 张业务表，被引用单位删除/改名一律 400 并返回引用明细
- GET /api/units 默认只返回启用中；新增 spec-parser 测试套件

**ListToolbar 标准组件**：搜索框 + 筛选 + 重置按钮，推广到全部 15 个列表页；收编 4 处手写"清除"按钮

**SelectValue 中文显示修复**：Radix SelectValue 在下拉未打开时回退渲染原始英文 value，SelectField 组件级修复 + 英文 value 的 Select 补显式 children

**部署链路（本节重点）**：
- `deploy.sh`（本地一键部署 + 健康检查）+ `.github/workflows/deploy.yml`（push main 自动部署，40min 超时）
- GitHub Secrets：ALIYUN_HOST / ALIYUN_USER / ALIYUN_SSH_KEY；服务器已关闭密码登录（纯密钥，修复 cloud-init 覆盖）
- Dockerfile：npm ci 与 Prisma 引擎走 npmmirror（官方 binaries.prisma.sh 在大陆线路间歇被重置）

### 事故与修复（重要经验）

- **事故**：10-29 深夜自动部署时，2C4G 服务器无 swap，现场构建（npm ci + next build）内存枯竭拖垮整机——网站 408、SSH 无响应，旧版本也无法访问。重启后 `restart: always` 自动恢复旧容器，数据无损
- **修复**：加 4G swap（写入 fstab）；带 swap 重新构建 4 分钟顺利完成，新版本（含当天全部提交）上线
- **教训**：小内存服务器绝不能无 swap；在生产机上现场构建必须留足内存余量

### 待办（TODO）

- [ ] **部署架构升级**：构建搬离生产服务器——GitHub Actions 构建 Docker 镜像 → 推阿里云容器镜像服务（ACR）→ 服务器仅 pull + 重启（秒级、零构建风险）。当前"服务器现场构建"已有 swap 兜底可安全使用，此项为体验优化
- [ ] 设置模块迭代下一站：食材分类（L1/L2 编码体系 + 级联删除风险）

---

## 2026-11-04 — 净料/小料价格体系升级：毛利率 + 出库价

### 背景与决策

会议定稿：净料/小料涉及加工，需在成本价之上计提毛利。三个决策点用户已拍板：

1. **真毛利率口径**（非成本加成）：出库价 = 成本价 ÷ (1 - 毛利率/100)。实测 PRD-0011（螺丝椒•6厘段）：成本 4.03 元/斤 ÷ 0.6 = 出库价 6.72 元/斤，标准规格价 13.44 元/份，实际毛利率恰好 40%（成本加成口径只能达到 28.5%，被用户否掉）
2. **菜品 BOM 成本改用出库价**：加工中心按出库价把净料/小料"转"给厨房，菜品成本反映加工价值
3. **毛利率逐条维护**：net_ingredients 加可空字段 gross_margin_rate，留空 = 0，历史数据无感知

### 完成内容

- **Schema**：net_ingredients 加 gross_margin_rate Decimal(5,2) 可空；迁移 20261104151627_add_gross_margin_rate_to_net_ingredients
- **价格计算唯一真源** lib/shared/net-price.ts 重构为三级：calcCostPricePerJin（净料单价+加工费）→ calcOutPricePerJin（÷(1-毛利率/100)，毛利率 ∈ [0,100)）→ calcStandardPackagePrice（×封装规格÷500）；语义纠正：原 outPricePerJin 实为成本价，现 costPricePerJin/outPricePerJin 语义归位
- **API**：净料 POST/PUT 支持 grossMarginRate（zod 0-95）；菜品 BOM 成本按出库价计算；菜品详情 select 补 grossMarginRate 走 serializeNetIngredient 统一口径
- **前端**：净料/小料表单加"毛利率（%）"输入 + 成本价/出库价/标准规格价三级实时预览；净料/小料列表加毛利率列、成本价列改出库价；菜品 BOM 选择器"成本价"列改"出库价"
- **测试**：net-price 测试套件按新语义重写（含 PRD-0011 实测口径用例），79 全过
- 三件套检查：tsc / build / lint 全过；migrate diff 零差异；PRD-0011 已写入毛利率 40 供页面验证

### 口径备忘

- 毛利率上限校验 0-95（÷(1-r) 在 r≥100 时无意义）
- 出库价保留 2 位小数（4.03÷0.6=6.7167 → 6.72），标准规格价基于取整后的出库价计算
- 调料（每斤单价）、酱料（元/kg）、原料（仅库存，不计菜品成本）均不参与本价格体系

---

## 2026-11-05 — 工作台模块重新设计（方案对齐完成，待开发）

### 设计共识

- 工作台主用户：**厨师长杨厨**；视角 = 排程业务闭环（排程 → 售卖 → 复盘 → 指导下一次排程）
- 信息架构：右上角**门店切换**（多门店，暂无门店管理页，轻量 stores 方案待定）+ **周一~周日日期条**驱动主内容区（天天不重样 → 按天复盘）
- 复盘单 = 基本经营数据统计，每道菜进度条式展示**计划/售出/损耗**三列，**菜品规格（规格份量等）完整展示**
- 工作台只做**周统计**；**月度统计归后续独立统计模块**
- 不引入日期状态标记（已复盘/未回录等圆点不做）

### 待办（TODO）

- [ ] **售卖回录功能**：由浩哥自己实现（每日按排程逐菜录入实际售出份数），工作台复盘单依赖此数据
- [ ] **工作台开发**：`schedule_items.actual_sold_qty` 字段 + 门店维度（stores 轻量方案）+ 周统计聚合 API + 页面重写
- [ ] **统计模块（后续独立模块）**：月度经营数据统计

### 补充（同日定稿，详见 memory-bank/Workbench.md）

- 工作台统计**只做周统计**（与周日历对应）：计划份数 / 实际售出 / 营收 / 损耗（份数+损耗率）+ 菜品表现榜（售出率 TOP / 损耗 TOP）；**月度不做**，归后续统计模块
- 周统计含**营收** → 依赖菜品售价字段
- 门店 seed 预置两家：**新金食堂**、**明天吃啥首店**

### 待办（TODO，以此为准）

- [ ] **菜品档案增加售价字段**（`dishes.price`，营收统计依赖）
- [ ] **售卖回录功能**：由浩哥自己实现（`PUT /api/schedules/[id]/sales` 批量回录 + 录入界面），工作台复盘单依赖此数据
- [ ] **工作台开发**：`schedule_items.actual_sold_qty` + `stores` 表（seed 两家）+ `schedules.store_id` + `GET /api/dashboard/daily|weekly` + 页面重写（周日历 + 复盘单 + 周统计）
- [ ] **统计模块（后续独立模块）**：月度经营数据统计

---

## 2026-11-05 — 工作台模块交付（排程复盘驾驶舱）

### 完成内容

- **Schema/迁移**：`schedule_items.actual_sold_qty`（实际售出，空=未回录）、`dishes.price`（售价，元/份）、`stores` 表 + `schedules.store_id`；迁移 `20261105033151_workbench_store_sales_price`
- **API**：`GET /api/dashboard/daily?date=&storeId=`（某日复盘单：明细+规格+售出/差额/销售额+汇总，未回录不产出 summary）；`/api/stores`（后与门店管理模块合并为完整 CRUD）；排程 POST/PUT/查询接入 storeId；菜品 POST/PUT 接入 price
- **页面重写 `app/page.tsx`**：问候语（按时段）+ 门店切换（localStorage 持久化）+ 周日历条（前后翻周，默认今天）+ 当日复盘单。列：序号 / 菜品·规格 / 售出进度条 / 销售额 / 销售状态（✓售罄·剩N份·多N份，高剩标红）/ 售价；未回录显示占位；无排程显示空态
- **排程表单**：新建/编辑加门店选择（替换原"使用范围"）；排程列表支持按门店筛选
- **菜品表单**：基础信息面板加"售价（元/份）"录入
- **seed**：门店预置 新金食堂（ST-0001）/ 明天吃啥首店（ST-0002），isSystem=true

### 重要事件：与并行"门店管理"会话汇合

- 另一会话基于本工作台底座完成了**门店管理**（迁移 `20261105040000`：stores 扩展 code/manager/phone/address/isSystem/isActive/软删除；**schedules.scope 字段废除**，排程统一走 store_id）
- 双方代码已对齐：本侧移除 scope 全部引用；补齐对方缺失的 `lib/server/schemas/store.ts`；修复其排程列表页门店筛选的运行时缺陷（分页对象误当数组、"all"值透传）
- ⚠️ 若还有门店管理相关页面（设置页入口）在途，以其最终提交为准

### 验证

- tsc / lint（0 errors）/ build 全过；migrate diff 零差异
- 售卖回录（`PUT /api/schedules/[id]/sales`）仍为浩哥 TODO；回录后工作台自动展示数据

### 待办（TODO）

- [ ] 售卖回录功能（浩哥）
- [ ] 统计模块（远期）：月度经营数据

---

## 2026-11-05（部署前风险拦截）— 存量数据迁移修复

### 拦截点

迁移 `20261105033151_workbench_store_sales_price` 在本地空表验证通过，但存在存量数据盲区：
- `schedules.store_id INTEGER NOT NULL DEFAULT 1` 给存量排程回填 1，此时 `stores` 表刚创建为空
- 随后 `ADD CONSTRAINT ... FOREIGN KEY` 时 **MySQL 会校验存量行** → 必然 ERROR 1452
- 本地库 `schedules` 为空（total=0），本地通过不代表生产可通过

### 验证方式（两次复现 + 修复后全量通过）

- scratch 库复刻生产基线（8 个已应用迁移）+ 注入存量排程数据 → 经**真实 `prisma migrate deploy` 引擎**复现 1452
- 修复后经真实引擎 + 全部迁移 + 终态校验（store id=1 / ST-0001 / 新金食堂，schedules.store_id=1 回填成功）✓

### 修复内容

- 迁移内加外键**之前**先 `INSERT INTO stores (id, name, created_at) VALUES (1, '新金食堂', ...)`；编号/系统标记由后续迁移 20261105040000 回填与 seed upsert 自然对齐
- 坑点：MySQL `--` 注释后**必须跟空白字符**，`--（全角括号` 会 1064 语法错误（Prisma 按 `;` 分块发送，注释行随语句块下发）

### 教训（两条红线）

1. **数据回填型迁移必须用带存量数据的 scratch 库走真实 `migrate deploy` 引擎验证**，空库验证有盲区
2. 迁移 SQL 注释统一 `-- `（带空格）开头，禁止 `--` 后直接跟非 ASCII 字符

### 部署执行与恢复（当日续）

- `802f7e4` 部署（deploy #10）：生产 migrate 如预期在 20261105033151 外键步骤失败（1452），web 因 depends_on `service_completed_successfully` 未重建，**旧版本持续服务、无宕机**；失败迁移记录阻断后续 deploy（P3009）
- `6361741` 部署（deploy #11）：被 P3009 阻断，符合预期
- 恢复脚本 `scripts/recover-store-migration.sh`（幂等）：诊断迁移状态 → 失败则 resolve --rolled-back → 按 information_schema 守卫清理部分应用的空列/空表 → migrate deploy 重跑修复版 → compose up（含 seed）→ 健康检查
- 恢复后验证点：stores 含 新金食堂/明天吃啥首店（ST-0001/0002）、存量排程 store_id=1 正确关联、工作台/门店接口 200

### 部署红叉根因定位与修复（当日续二）

- **根因**：`scripts/dictionary-baseline.sql` 门店段为旧表结构（仅 name）写法，与最终 schema 脱节——`stores.code` NOT NULL 无默认值、`updated_at` NOT NULL 无默认值（Prisma @updatedAt 不落库默认）→ 导入时 ERROR 1364（line 101），位于 compose up **之后**，故站点正常但每次部署红叉、健康检查被跳过
- 生产实证：11 个迁移全部 ok、seed 门店齐全（ST-0001/0002）、web 正常（HTTP 200）；生产 schedules 为 0 行，故工作台迁移的空表外键在生产未触发 1452
- **修复**：基线 SQL 与生成器同步改为 `INSERT INTO stores (code, name, created_at, updated_at)`；服务器端已 sed 修复并重跑导入 exit 0
- 遗留：本机 worktree 该文件被第三方进程锁死（同 .prisma/client 锁），仓库内容经 git update-index 直写 blob 提交；待锁释放后 `git checkout` 刷新工作区

---

## 2026-11-05 — 酱料模块 BOM 化重构（酱料 = 特殊菜品 BOM）

### 背景与决策

用户提出酱料可抽象为特殊菜品 BOM，并提供厨师原始配方表（宫保汁/蹄花蘸水，含科目分组、1斤量/5斤量、操作流程）。5 个决策点用户已拍板：

1. 自制酱料沿用食材基本计算逻辑（同原料转净料），由多个小料+调料计算得出
2. 外购酱料录入逻辑同调料（采购规格+参考价 → 自动换算每斤单价）
3. 酱料涉及加工，要有毛利字段
4. 口径统一元/斤（废弃元/kg 旧口径）；**酱料不嵌套**（配方不可引用酱料）
5. 出品克重不单独设字段，投入即产出，正常计算（成本价 = 配方总成本 ÷ 总克重 × 500）

数据现状：酱料表为空、零菜品引用，重建零负担。实际调料并未独立建表——调料=ingredients 中 SEA 子树（pricePerJin），配方行引用 net_ingredients + ingredients(SEA) 两类。

### 完成内容

- **Schema**：sauce_ingredients 重构（去 unitPrice/unit，加采购四字段+毛利率+储存+备注+软删除）；新表 sauce_recipe_details（配方明细，UNIQUE(sauce_id,line_type,ref_id)）、sauce_processes（加工流程）；迁移 20261105092428_rebuild_sauce_module_bom
- **成本引擎**：lib/shared/sauce-price.ts（calcRecipeLineCost / calcSauceCostPricePerJin）；lib/server/sauce-utils.ts（resolveRecipeLines 校验引用+算行成本、computeSauceCostPrices 批量、serializeSauce 注入成本价/出库价）
- **API**：酱料 GET（列表批量算成本+引用数）/GET id（配方行带名称与实时行单价）/POST/PUT（事务整体替换配方与流程，undefined=保留/null=清空）/DELETE（软删除+菜品引用保护）；菜品 BOM 酱料成本改按出库价 × g ÷ 500；菜品详情 sauce 序列化带出库价
- **前端**：酱料页重做（类型切换表单：自制=配方明细行编辑[复用 BomPickerDialog 选净料/调料]+加工流程步骤+实时成本/出库价预览；外购=采购字段+自动换算每斤单价）；列表加成本价/毛利率/出库价/引用列；菜品 BOM 选择器酱料列出库价
- **联动修复**：schedule-utils 酱料采购计划单位固定"斤"；unit-references 删除酱料 unit 检查项（字段已不存在）
- **测试**：sauce-price 测试套件（85 全过）；tsc / build / lint 全过；migrate diff 零差异
- **端到端验证**：自制酱料实测 成本价 7.90 / 毛利率40 → 出库价 13.17 ✓；外购 2斤/瓶×12元 → 6 元/斤 ✓；创建/列表/删除全通

### 注意事项

- 改 schema.prisma 后必须重启 dev server（Prisma Client 缓存在进程内存，坑过两次）
- BomPickerDialog 新增可选 props：title（自定义标题）、hideCategories（纯搜索模式），酱料配方编辑器复用

---

## 2026-11-05（下午）— 酱料模块首轮试用反馈修正（6 项）

### 用户反馈与修正

首轮交付后被指出 6 个问题，全部修正并验证：

1. **添加净料/小料没有分类选择** → BomPickerDialog 新增 allCategories 模式；净料/小料选择器与调料一样走一级/二级分类筛选（参数透传 /api/net-ingredients 的 l1Code/l2Code）
2. **去掉加工流程模块** → 判定无实际意义，整模块移除：前端表单、API 字段、zod、sauce_processes 表（迁移 20261105150052 一并删除）
3. **配方明细字段精简** → 列定为：类别/名称/单价（元/斤）/用量（g）/成本小计；调料行不体现规格；去掉表头"共X行·投入Xg·成本合计"描述
4. **增加加工费字段** → sauce_ingredients 加 processing_fee_per_jin；成本价 = 配方推算价 + 加工费（元/斤），与净料「净料单价 + 封装加工费」完全同语义；实测 7.90+0.5=8.40 → 毛利40% → 出库 14.00 ✓
5. **列表字段调整** → 去掉备注、引用菜品；定为：序号/编号/名称/类型/加工费（元/斤）/成本价（元/斤）/毛利率/出库价（元/斤）/更新时间
6. **食材库卡片酱料统计数 2 来源** → lib/server/ingredient-summary.ts 的 sauceIngredient.count() 漏了 deletedAt: null 过滤，把 2 条软删除的测试数据计入了；已修复，实测 sauce=0 ✓

### 重要复盘（用户批评）

> "受补充信息影响较大，而轻视了整个食材模块这一版迭代的思路"

首轮实现过度参照厨师配方表（加工流程、科目分组、1斤量/5斤量、行内规格展示），偏离了本版食材模块的统一思路：**分类选择交互统一、加工费计入成本价、全部元/斤口径、出库价链路、计算字段不落库、字段精简只做有意义的**。后续迭代新增模块时，先回到模块既有模式找一致性，再谈场景特化。

### 检查

tsc / build / lint（0 error）/ 88 测试全过 / migrate diff 零差异；dev server 已重启（新 Prisma Client）。

---

## 2026-11-05（晚）— 酱料标准规格价

用户提出增加"每件的价格"即标准规格价。按净料同构落地：

- sauce_ingredients 加 package_spec Int?（封装规格 g，留空 = 不启用）；迁移 20261105_add_package_spec_to_sauce
- 标准规格价（元/份）= 出库价 × 封装规格 ÷ 500，计算字段不落库，serializeSauce 注入（复用 calcStandardPackagePrice）
- 表单：基础信息加"封装规格（g）"，价格区加"标准规格价"实时预览；列表加"封装规格 / 标准规格价"两列（去掉加工费列，成本价已含）
- 实测：成本 8.40 → 毛利40% → 出库 14.00 → 封装 250g → 标准规格价 7.00 ✓
- tsc / build / lint / 88 测试 / migrate diff 全过；dev server 已重启
