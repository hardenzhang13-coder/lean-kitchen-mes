# 精益厨房 V3 — 项目推进日志

> 按日期记录核心推进过程，包括技术决策、问题解决、功能交付。

---
---
## 2026-11-20 — 调料标准化规格改造（食材库基础数据夯实 · V3.3）

### 背景

试运行反馈：调料此前只有自由文本采购规格（如「1.2kg/瓶」）与每斤单价，菜品 BOM 里用量被系统固定为 100g 且不可编辑。参照「原料 → 净料/小料」的既有链路，把调料纳入同一套标准化体系。

### 口径决策（与用户对齐）

- **标准规格统一以 g 计**，不引入瓶/袋/桶等单位；采购规格留在来源调料上仅作对照展示
- **BOM 用量强制 = 标准规格**（与净料/小料完全同构）
- **份量复用净料同一套枚举**（`PORTION_VALUES`），不新增档位、不允许自由数字
- **价格链全套同构净料**：出成率 → 单价 → +封装加工费 → 成本价 → ÷(1−毛利率) → 出库价 → 标准规格价（元/份）
- **菜品 BOM 调料 Tab 只列已标准化的规格**；未标准化的调料不进 BOM（与「原料不能直接进 BOM」同构）
- **存量 BOM 不迁移**：`dish_seasoning_details.spec_id` 为空的行保持旧口径（每斤单价 × 克需求）

### 数据模型

- 新表 `standard_seasonings`（迁移 `20261120100000_add_standard_seasonings`）：编号 `SEA-SP-xxxx`，来源调料、标准规格（g）、份量、出成率、单价、封装加工费、毛利率、继承分类、软删除
- `dish_seasoning_details` 增 `spec_id`（可空 FK）+ 索引
- 迁移审计：仅 `ADD COLUMN` + `CREATE TABLE` + `CREATE INDEX` + `ADD FOREIGN KEY`，**无 UPDATE/DELETE 碰业务表**

### 交付

**服务端**

- `lib/shared/seasoning-spec.ts`：默认名「{调料名}•{克数}g」与价格派生（复用 `calcNetUnitPrice` / `calcCostPricePerJin` / `calcOutPricePerJin` / `calcStandardPackagePrice`，**零新公式**）
- `lib/shared/bom-amount.ts`：新增通用 `resolvePackageSpecAmountG`，`resolveNetBomAmountG` 改为委托（行为不变）
- `lib/server/standard-seasoning-utils.ts`、`lib/server/schemas/standard-seasoning.ts`
- API `/api/standard-seasonings`（GET 列表分页 / POST / GET[id] / PUT / DELETE）+ `/api/standard-seasonings/[id]/dishes`；权限登记到 `access-control.ts` 主数据前缀
- 联动：`lib/server/seasoning-spec-sync.ts`（BOM 行同步 + 菜品成本重算）+ `lib/server/seasoning-spec-recalc.ts`（只重建未完成排程的**采购计划**与相关生产计划快照；切配工单不含调料故不动）；有执行进度抛 409 整体回滚
- 菜品 BOM 接口：`dishBomSeasoningSchema` 增 `specId`，服务端按 `specId` 分支——有则用量强制 = 标准规格、成本按出库价；无则沿用旧口径
- 成本汇总 `dish-costing.ts`、采购计划 `schedule-utils.ts`（标准化调料毛需求 = 标准规格 × 道数 ÷ 出成率）同步新口径
- 从 `incomplete-document-recalc.ts` 导出 `assertScheduleHasNoProgress` / `hasPlanProgress` 供复用（仅加 export，行为不变）

**前端**

- 新增 `standard-seasoning-form-dialog.tsx` / `standard-seasoning-form-fields.tsx`（转化弹窗，来源调料锁定，含只读派生字段）
- 新增 `standard-seasoning-section.tsx`（调料详情页「标准规格」区块：列表 + 新建/编辑/删除/查看关联菜品）
- 新增 `standard-seasoning-dishes-dialog.tsx`（关联菜品）
- 调料详情抽屉集成「标准规格」区块（`ingredient-detail-sheet.tsx`）
- 菜品 BOM 选择器调料 Tab 换源为标准化规格，列改为 名称/标准规格/采购规格/份量/出库价/标准规格价；`dish-form/types.ts` 增 `normalizeStandardSeasonings`、`BomItem.specId`、`dishToBom`/`bomToPayload` 同步
- 菜品详情 BOM 表增加「份量」列

### 校验

- `npx tsc --noEmit` 0；`npm run lint` 0 error 0 warning；`npm run build` 通过
- `npm test`：69 套件 / 354 用例全绿（新增 seasoning-spec / bom-amount / seasoning-spec-sync / standard-seasonings API ×2 / BOM specId 分支 / 转化弹窗 共 8 组用例）
- `npx prisma migrate diff --from-migrations --to-schema` 输出空迁移（零差异通过）
- 迁移已在本地 `migrate deploy` 应用并 `prisma generate`

### 交互整改（试运行实测反馈后重做）

用户实测后反馈交互形态不符预期，本轮按「参照原料转净料」的既有交互重做：

- **调料清单操作列**新增「转调料」（`ArrowRightLeft` 图标、`variant="default"`），位置与样式对齐原料清单的「转净料」
- **转化弹窗**参照「转净料」弹窗：`size="workbench"` + 头部来源调料摘要（编号 · 名称 · 采购规格 · 分类）+ 表单主体 + 底部保存；标题「转调料」
- **名称口径**：标准规格的「调料」字段默认取来源调料名，不再拼接「•克数g」后缀；同一调料的多个包装规格靠「包装规格」列区分
- **字段命名统一**：包装规格（g）、份量、调料单价（元/斤）、出库价（元/斤）、标准规格价（元/份）
- **详情页形态调整**：移除抽屉内嵌的「标准规格」区块与「关联菜品」能力（调料模块不需要关联菜品，API 的 `dishCount` 一并移除）
- **底部功能区**新增「查看封装调料」：弹窗列出该调料转化出的全部标准规格，展示字段固定六项——名称 / 包装规格 / 份量 / 调料单价 / 出库价 / 标准规格价；行操作保留编辑与删除
- **调料详情主操作**改为「转调料」（编辑退到次级操作区），与原料详情页「转净料 + 复制 + 编辑」的分工一致
- 删除文件：`standard-seasoning-section.tsx`、`standard-seasoning-dishes-dialog.tsx`、`/api/standard-seasonings/[id]/dishes`

### 版式再对齐：转调料弹窗复用「转净料」版式

首版只复用了弹窗外壳（workbench 尺寸、来源摘要、保存区），表单体仍是单列纵向堆叠，
与「转净料」的版式不一致。本轮按 `net-ingredient-form-fields.tsx` 的 `net-dialog` 分支对齐：

- 表单体改为 **顶部一行基本信息 + 三列并排**：顶部「调料」名称一行，下方 `FormLayout variant="workbench"`
  铺开「规格指标 / 加工指标 / 价格指标」三列，与转净料逐段对应
- 弹窗头部右侧新增 **「查看已有封装调料（N）」** 入口，位置与样式对齐转净料的「查看已有净料（N）」；
  点击打开半屏抽屉列出该调料已有的标准规格
- 「查看封装调料」由普通弹窗改为 **RecordSheet 半屏抽屉**，与「查看已有净料」同一形态
- 新增 `standard-seasoning-list-sheet.tsx`（替代 `standard-seasoning-view-dialog.tsx`），承载查看/编辑/删除

### 顺带修复：本地登录接口 404（proxy 透传请求头）

- **现象**：`npm run dev` 下 `/api/auth/*`（login / me / logout）全部返回 404，登录表单无法使用；`/api/health` 正常。生产（`next start`）不受影响。
- **根因**：`proxy.ts` 中 `/api/auth/*` 分支返回裸 `NextResponse.next()`。Next 16 Turbopack dev 下不传 `request: { headers }` 会丢失原始请求，路由处理器收不到请求，被判为未匹配路由（404）。
- **修复**：改为 `NextResponse.next({ request: { headers: req.headers } })`，并在代码注释里写明原因。其余 API 分支本来就传了 `requestWithIdentity()`，不受影响。
- **验证**：登录 200 并正常下发会话 cookie；`/api/auth/me` 200；`/api/auth/logout` GET 返回 405（仅允许 POST，证明路由已匹配）；工作台 / 调料清单 / 菜品列表 / 菜品详情 四个页面 SSR 全部 200。

### 遗留与后续

- 出库单与净菜库存暂不支持标准化调料（现有库存只覆盖净料/小料），记为后续批次
- 采购单入库仍按来源调料（采购品）录入，未按标准规格换算
- 份量枚举粒度（1/4/6/8/10 份）对大规格瓶装偏粗，暂按最接近档位使用，待业务反馈再扩枚举

---

## 2026-11-19（续）— 部署 5e17269 并完成生产 BOM 对齐

### 合并与门禁
- 将最新 main（含 48c2712 等 5 个提交）合并进 BOM 联动分支，解决 `progress.md` / `prisma/CLAUDE.md` 两处文档冲突
- tsc 0 / lint 0 / build 通过 / Jest 63 套件 315 用例 / Prisma 零差异

### 部署
- `workflow_dispatch` run `44350895503`，head `5e17269`；build → deploy-prebuilt → health 全绿
- `migrate` / `db-users` 均 Exited(0)；web healthy；`/login` 200、`/api/health` ok

### 生产对齐（只读 → 备份 → apply）
- 备份 `backups/bom-align-20261119_004935.sql`；审计 `backups/bom-align-audit-20261119_004935.json`
- 对齐 13 行 BOM（11 个净料/小料）；重建排程 `SCH-20261119-001` 的 20 条切配、19 条采购与计划 `PPL-20261118-004` 快照
- 复核：BOM 漂移 0；计划 8 的 20 行份数全部为整数；已完成计划 5/6、2 张出库单、库存流水未变；再跑预览输出「无需处理」

---
---
## 2026-11-19 — 部署 48c2712（菜品发布口径 / 出库金额 / 食材库反馈）

### 合并与提交
- `3512f30` feat(dishes)：试运行菜品发布口径整改（发布必填收敛、类别可空、份量默认小碗菜·10份）
- `48c2712` fix(inventory)：出库金额改为标准规格价 × 出库份数，主体选择三列栅格，打印页去分类加单价
- 一并带上此前未部署的 `3960120`（食材库五点反馈）、`631e6f4`（文档同步）、`988cb24`（净料关联菜品）
- 推送 `1b935c7..48c2712` 到 origin/main

### 门禁
- `npx prisma migrate diff` 空迁移；`npx tsc --noEmit` 0；`npm run lint` 全量 0
- `npm run build` 成功；`npm test` 60 套件 / 307 用例全绿

### 部署
- `workflow_dispatch` 触发 `deploy.yml`，run `44348374076`，head `48c2712`；build → deploy-prebuilt → health 全绿（16:32–16:35 UTC）
- 迁移 `20261118120000_dish_category_optional_and_portion_default` 于 16:35:26 UTC 应用；`migrate` 与 `db-users` 均 `Exited (0)`；web healthy、日志 `Ready` 无错误

### 部署后只读复核
- `dishes.category_id` 可空（YES/NULL）、`portion` 默认 `小碗菜·10份`；`outbound_orders` 的 `subject_type` / `self_order_id` 就位，`store_id` / `schedule_id` 可空
- 基线行数：ingredients 78 / net_ingredients 118 / dishes 12 / schedules 1 / production_plans 4 / prepped_stock 31 / outbound_orders 2；12 条菜品份量全部为 `小碗菜·10份`
- `/login` HTTP 200，`/api/health` `{"status":"ok"}`

---
---
## 2026-11-18（续）— 菜品 BOM 与净料/小料标准规格实时联动

### 背景
生产计划出现 2.25、3.38 等小数份数。根因是菜品 BOM 的 `amount_g` 是建档时快照，净料封装规格后续修改后不回写；生产计划用「旧用量 ÷ 新规格」计算，产生尾包。

### 交付
- 唯一真源改为 `NetIngredient.packageSpec`；新增 `lib/shared/bom-amount.ts`，排程/采购/成本/菜品详情/表单统一读取派生用量。
- BOM 保存 `PUT /api/dishes/[id]/bom`：服务端按当前封装规格覆盖净料/小料 `amountG`，并校验引用存在与 MIN 分类归属。
- 净料/小料 PUT 改为单事务：规格/出成率/来源变化时同步 BOM 行、重算菜品成本、重建待生效/进行中的排程与生产计划；有生产/出库/确认进度时返回 409 并整体回滚。
- 菜品转化/复制：净料/小料 BOM 用量改用目标档案 `packageSpec`，成本按目标规格实时重算。
- 新增一次性对齐脚本 `scripts/align-dish-bom-package-spec.ts`（预览 + `--apply` + 审计 JSON）；操作手册见 `docs/net-spec-bom-sync.md`。
- 本期不含调料；`Ingredient` 尚无 `packageSpec`，留待后续阶段。

### 校验
- `npx tsc --noEmit` 0；新增 helper/同步/重算单测通过；全量 Jest 58 套件 / 292 用例通过。

---
---
## 2026-11-18（续 2）— 库存模块试运行反馈：出库单三处修正

### 交付
- 创建出库单「选择主体」：净菜切配中心与门店合并为一行三列栅格；切配中心卡片用主色描边 + 浅主色底 + 「切配中心」标签，与门店卡片区分
- 出库单单价：创建页第 3 步明细与出库单详情表在「计划量」后新增「单价」列，取**标准规格价（元/份）= 出库价 × 封装规格 ÷ 500**（`net-price.calcStandardPackagePrice`，由 API 注入 `standardPackagePrice`）
- 出库金额口径同步改为「标准规格价 × 出库份数」（`prepped-stock.calcPortionAmount`，替换原 `calcLineAmount(出库价, 克数)`），保证单据上「单价 × 份数 = 金额」；存量出库单金额保留旧口径快照，不回算
- 打印出库单：去掉一级分类、二级分类两列；「封装规格」后新增「单价」；表头「封装规格（份）」改为「封装规格」；合计行 colspan 6 → 5

### 校验
- `npx tsc --noEmit` 0；`npm run lint` 全量 0；浏览器实机走通主体选择（三列 + 切配中心高亮）、创建页与详情页单价列、打印页表头与合计行

---
---
## 2026-11-18（续）— 菜品表单试运行问题整改

### 背景
试运行反馈：新增菜品时发布门槛过高（辅料必填）、售价/毛利率漏填没有明确提示、部分基础字段实际用不上却强制必填、份量默认值不符合当前主流场景、用料搜索范围过宽。

### 交付
- 发布校验（前后端共用 `lib/shared/dish-publish.ts`）：名称、荤素类型、售价（>0）、主料 ≥1 必填；类别/菜系/做法/口味与辅料等其余用料全部放开。
- 售价/毛利率必填：表单标题主题色加粗并标注 `*`；保存草稿与发布都会给出「请填写售价（元/份），毛利率会根据成本自动计算」等人性化提示；毛利率仍由售价与实时成本派生，不入库。
- 菜品类别改为可空（迁移 `20261118120000_dish_category_optional_and_portion_default`）：未分类菜品编号使用 `DSH-GEN-xxxx`，复制/转化沿用同一规则。
- 份量默认值统一为「小碗菜·10份」：新建表单、存量缺省回退、`createDishSchema` 与 `dishes.portion` 列默认值同步。
- 用料选择弹窗搜索占位改为「搜索名称...」，搜索范围与食材库一致，只匹配名称字段。

### 校验
- `npx tsc --noEmit` 0；`npm run lint` 0；`prisma migrate diff` 空迁移；定向 Jest 9 套件 / 39 用例通过。
- 迁移未应用：本地 `migrate dev` 因历史迁移 `20261110090000` 被改过而要求重置数据库，已改为手写迁移文件，待部署时由 `migrate deploy` 执行。

---
---
## 2026-11-18 — 出库单支持「净菜切配中心」主体

### 背景
内部生产单纳入生产计划后，切配中心生产的净菜无法开出库单（出库单原先只认门店 + 排程单）。实际使用中需要以切配中心为主体的出库凭证。

### 交付
- Schema + 迁移 `20261118100000_add_outbound_cutting_center_subject`：`outbound_orders` 新增 `subject_type`（store / cutting_center）与 `self_order_id`，`store_id` / `schedule_id` 改为可空；来源单据快照字段继续复用 `schedule_code/title/date`。
- 出库行构建：`lib/server/outbound-utils.ts` 抽出统一行构建，门店取切配工单、切配中心取内部生产单明细；进行中内部生产单按「未切配」默认不出库。
- API：`GET /api/outbound-orders?selfOrderId=` 报价预览；`POST` 支持 `scheduleId` / `selfOrderId` 二选一；列表与详情返回 `subjectType / subjectName / sourceCode / sourceTitle / sourceDate`。
- UI：创建出库单向导改为「选择主体 → 选择来源单据 → 确认明细」，第一步新增切配中心卡片；列表、详情、打印按主体显示「门店 / 切配中心」与「排程单 / 内部生产单」。

### 校验
- `npx tsc --noEmit` 0；`npm run lint` 0；定向 Jest 2 套件 / 10 用例通过。

---
## 2026-11-17（续）— 登录态延长至 12 小时 + 新建默认日期与工具链修正

### 1. 登录态 30 分钟 → 12 小时
- 业务反馈：30 分钟过短，后厨作业频繁被打断退出。
- 新增 `lib/shared/session-config.ts` 作为唯一口径：`SESSION_TTL_SECONDS = 12h`、`SESSION_RENEW_AHEAD_SECONDS = 1h`。
- `lib/server/session.ts` 与 `proxy.ts` 的 JWT 有效期、cookie `maxAge`、滑动续期阈值统一读取该常量，不再各自硬编码。
- 测试：`proxy.test` 补 SignJWT 签发链 mock 与「临近过期自动续期」用例；`session.test` 断言同步到 12 小时。

### 2. 新建默认日期
- 菜品排程、生产计划的新建弹窗与编辑表单默认日期由「明天」改为「今天」。
- 生产计划弹窗首行比例改 5:5；排程弹窗首行 5:5、已选菜品数量控件右对齐；两个列表的日期筛选宽度 190 → 380，选中后日期与星期完整展示。

### 3. 工具链修正
- `jest.config.ts` 与 `eslint.config.mjs` 排除 `.claude/**`：Claude 工作树副本位于仓库内，否则测试会被重复收集（57 → 114 套件）、lint 扫描卡死。

### 校验
- `npx tsc --noEmit` 0；`npm run lint` 0；`npm test` 57 套件 / 284 用例；`npm run build` 通过；`prisma migrate diff` 空迁移。

### 部署
- `workflow_dispatch` 触发 `deploy.yml`，run `44109184270`，head `5b167ba`；build → deploy-prebuilt → health 全绿。
- 部署前基线：原料 60 / 净料 92 / 菜品 7，流转表为空；部署后逐项一致。
- 迁移 `20261117090000_add_self_production_order` 已应用（仅建表），三张新表均为 0 行；`/login` 200，web 日志无错误。
- 已确认部署产物包含 43200 秒（12 小时）登录态常量。

---
---
## 2026-11-17 — 生产计划接入「净菜切配中心内部生产」

### 1. 新单据：内部生产单
- 新增 `self_production_orders` / `self_production_items` / `production_plan_self_orders`（迁移 `20261117090000_add_self_production_order`）。
- 状态机复用 `待生效 / 进行中 / 已完成`；只有「进行中」可被生产计划纳入，同一张单最多归属一个未删除计划；待生效可物理删除。
- `source_type` 由服务端按净料二级分类 `MIN` 派生，不信任客户端；`packageSpec` 缺失在创建/激活/汇总三处拦截。

### 2. 生产计划双来源
- `createProductionPlanSchema` 改为 `scheduleIds` / `selfOrderIds` 均可为空但至少选一（原先 `.min(1)` 会挡住纯自产计划）。
- `buildProductionPlanData(prisma, scheduleIds, selfOrderIds)`：自产按 `份数 × 封装规格` 并入切配，按 `× 100 / 出成率` 折算原料毛需求并入采购；与排程同净料/同原料自动合并。
- 来源快照升级 v2：`{ version: 2, stores[], selfProduction[] }`，`normalizeSourceSnapshot` 同时接受 v1/v2。
- 修改计划时 `selfOrderIds` 可省略，省略即保留现有来源关联。

### 3. 完成生产修正
- 门店 `cutting_orders.actual_qty` 分摊分母改为「门店工单合计」，并按单店需求量封顶，避免自产数量稀释各店实际量。
- 计划完成时通过 `syncSourceSelfOrderStatuses()` 把来源内部生产单置为「已完成」。

### 4. UI 与权限
- 新增 `/self-production-orders` 列表 + 详情 + 新建/编辑弹窗（净料搜索、份数、切配量/毛料需求实时计算）。
- 生产计划新建/编辑弹窗改为「门店排程 / 内部生产单」双页签；详情与预览新增「内部生产」Tab；看板卡片显示内部生产单数量。
- 内部生产单不占用一级菜单，入口为生产页右上角「生产计划单 / 内部生产单」页签切换；列表改为与排程/生产计划同构的三列看板；详情页与排程详情对齐（信息卡、纳入计划提示条、明细合计、按角色控制写操作）。
- 新建弹窗对齐菜品排程单：右侧候选一行两列、仅展示名称与包装规格、支持一级/二级分类筛选；左侧已选行右侧带数量步进器；毛料需求统一以斤展示（1 斤 = 500g），与排程/生产计划口径一致。
- 侧边栏新增「自产」；`/api/self-production-orders` 已登记权限（读全体、写 admin/chef）。

### 校验
- `npx tsc --noEmit` 通过；新增/更新 7 个测试套件全绿。

---
## 2026-11-16（续 2）— 列表状态列可选 + 预览弹窗复用 + 工作台菜品明细

### 1. 状态列可见性

- 新增 `useStatusVisibility(storageKey)`：默认只展示「待生效 / 进行中」（已完成单据日常不必常驻），可在列表工具栏的「列」菜单里勾选；选择写入 localStorage，至少保留一列。
- 新增 `StatusColumnMenu`（`Columns3` 图标 + 复选菜单），排程与生产计划两个看板共用。
- `KanbanBoard` 改为按 `statuses` 顺序渲染，可见列数 1/2/3 分别映射栅格；`useScheduleBoard` / `useProductionPlanBoard` 接收可见状态并按列取数，避免「隐藏了还在请求」。

### 2. 预览弹窗抽为通用件

- 新增 `SchedulePreviewDialog` / `ProductionPlanPreviewDialog`（`app/components/ui/`），排程列表、生产计划列表、工作台共用同一份预览行为（菜单/切配/采购/门店排程页签）。
- 两个列表页各自内联的预览状态与取数逻辑随之删除（`schedules/page.tsx` −139 行、`production-plans/page.tsx` −168 行）。

### 3. 工作台周历

- `GET /api/dashboard/weekly` 的排程卡片补 `items`（菜品名、份数、金额），周历悬浮可直接看今日售卖菜品。
- 周历内点击排程/计划卡片改为打开上述预览弹窗，与列表页一致。

### 校验

- `npx tsc --noEmit`、`npm run lint`、`npm test`、`npm run build` 全部通过。

---
---
## 2026-11-16（续）— 菜品转化联动净料/小料规格 + 复制名称去唯一校验

### 1. 转化入口与语义

- 列表操作列转化图标改为与「转净料」一致的 `ArrowRightLeft`，保持 ghost 弱化，不抢主操作。
- 转化被视为「同一道菜在不同场景下的档案定义」：菜品用量、净料、小料按目标份量倍率同步换算。

### 2. 转化预览与缺失规格确认

- 新增 `POST /api/dishes/[id]/scale/preview`，返回 `factor` 与净料/小料匹配计划：
  - 食材库已有「同来源原料 + 目标份量 + 同分类」规格 → `existing`，直接复用
  - 没有 → `missing`，按源封装规格 × 倍率生成提案（名称、封装规格、出成率、加工费、毛利率）
  - 缺少来源原料 → `canCreate: false`，阻止执行并提示先维护食材
- 新增 `app/components/dishes/dish-scale-dialog.tsx`：选择目标份量 → 自动加载预览 → 展示净料/小料分区；缺失项可编辑，已存在项只读；确认后调用转化接口。
- 新档案名称沿用源菜品名称（份量由 `portion` 区分），状态草稿；成功后刷新列表并打开新档案抽屉。

### 3. 转化执行

- `POST /api/dishes/[id]/scale` 在 Serializable 事务内：
  1. 重新构建计划（处理预览与执行之间的并发变化）
  2. 缺失规格按用户确认值创建 `NetIngredient`，编码沿用 `PRD-xxxx`；名称末尾的标准封装规格与 `packageSpec` 同步（如「平包菜•称重•500g」→「•600g」）
  3. 通过 `netIngIdMap` / `minorIngIdMap` 把新菜品 BOM 指向目标规格
  4. 调用 `createDishVariant()` 生成草稿菜品
- 同一净料在 BOM 中重复引用时，规格计划按净料 id 去重；执行阶段跨主料/小料复用已解析的目标规格，避免重复建档与 React 重复 key。
- 纯逻辑抽到 `lib/server/dish-scale-plan.ts`，类型定义在 `lib/shared/dish-scale.ts`，预览与执行共用。

### 4. 复制

- 复制不再做菜品名称唯一校验：编号本身唯一，允许同名档案；默认仍为「源名称-副本」。
- 复制弹窗保留名称编辑，提交按新建处理。

### 校验

- `npx tsc --noEmit`、`npm run lint`、`npm test`（53 套件 / 263 用例）、`npm run build` 全部通过。
- 新增测试覆盖：转化计划匹配/缺失/阻塞、转化执行建档与 BOM 映射、复制同名允许、转化弹窗预览与提交。



### 部署
- `workflow_dispatch` 触发 `deploy.yml`，run `43754248012`，head `d85b2ca`
- build 推送 web / migrate 镜像 → deploy-prebuilt 拉取重启 → health 通过；现场构建按条件跳过

### 部署前审计
- 两条新迁移：`add_created_at_to_ingredients`（加列 → 存量回填固定日期 → 改 NOT NULL）、`normalize_dish_status_pending`（pending→draft）
- 生产只读盘点：`dishes.status` 仅 published×3 / draft×1，**无 pending**，状态迁移为空操作；原料 51 / 净料 77 / 菜品 4 / 排程 3 / 计划单 3
- seed、`scripts/dictionary-baseline.sql`、`docker-compose.yml`、`Dockerfile`、workflow 自上次部署无变化

### 验证
- 迁移均已应用；migrate 容器 `Exited (0)`；web 镜像为 ACR `lean-kms-web:d85b2ca…`
- 12 张关键表行数与部署前完全一致；`ingredients.created_at` 51 条全部回填（2026-10-26 11:32:10）
- `/login` HTTP 200；web 日志无错误

### 存量标题回填
- `scripts/backfill-schedule-titles.mjs --apply`：3 条排程标题改为 `门店 · 周几（月日）·菜单`
- `scripts/backfill-production-plan-titles.mjs --apply`：3 张计划单标题改为 `切配中心·周几（月日）生产计划`
- 运行方式：服务器上用 migrate 镜像挂载 `scripts/` 执行（`docker compose run --rm --no-deps -v /opt/lean-kms-v3/scripts:/app/scripts migrate node …`）

### 遗留
- 菜品「建档时间」存量统一回填为 2026-10-26 11:32:10，早于净料最早建档（10-29），仅展示口径、不影响业务
- 新看板 / 弹窗 / 周视图仍待试运行实机验证

---
---
## 2026-11-16 — 排程模块整体优化（B3 前移：单据卡片视觉 + 业务加固）

> 同日回退：第 1 条的拟物化视觉层已按用户反馈整体移除，当前为扁平卡片，最终形态见第 8 条。

### 背景

试运行第一周反馈集中在排程：门店排程单与生产计划单共用列表且卡片几乎一样，一线看不出该动哪张；切配中心的「逐行三态确认 + 入库」只藏在计划单详情；排程进入「进行中」后界面无任何出口，不进计划单就永远卡住。本轮以「轻拟物·纸质单据」为视觉语言重做排程交互，并在不改 schema 的前提下补齐业务断点。

### 1. 视觉契约（B3.1）

- 新增通用件 `PaperCard` / `PaperCardHeader` / `PaperCardStat` / `PaperCardDivider`（`app/components/ui/paper-card.tsx`）与 `PaperStamp`（`paper-stamp.tsx`）；印章颜色只取 `statusToVariant`，始终带可见文字。
- `app/globals.css` 新增 `--doc-paper` / `--doc-paper-subdued` / `--doc-paper-edge` / `--doc-paper-edge-strong` / `--doc-ink` / `--doc-shadow` 与 `.doc-card-shadow`（Tailwind 任意值里的逗号会被截断，投影走显式类）。
- 基线 §6.1.1 新增「单据卡片」契约（结构六段、允许的视觉手段、禁止项、动效白名单、整卡可点击的可聚焦要求），§5 组件表登记；迭代基础 §3.2 登记通用件、§5 将 B3 标为进行中并说明提前启动；`.agents/skills/ui-baseline` 增加单据卡片条款；`/ui-kit` 补四态样张。

### 2. 列表（B3.2）

- `app/schedules/page.tsx` 从 756 行拆为：页面编排 + `schedule-card.tsx` + `production-plan-card.tsx` + `use-schedule-list.ts`（两套列表取数与筛选）。
- 卡片主操作按状态唯一：待生效→确认生产；进行中未纳入→纳入生产计划单（`/production-plans/new?scheduleId=`）；进行中已纳入→查看生产计划；计划单进行中→完成生产（列表内直接打开确认弹窗）；已完成→打印标签。
- 快速预览抽屉由裸 `Sheet`（`sm:max-w-4xl`）改为 `RecordSheet`；计划预览补「门店排程」Tab。
- 工具栏加日期快捷（今天 / 明天 / 近 7 天）；列表排序改为 `scheduleDate` / `planDate` 倒序（API orderBy）。
- 新增 `lib/shared/date-format.ts`（`getWeekDay` / `formatDate` / `formatMonthDay` / `dayOffsetInputValue`），替换本轮新增页面里的复制实现。

### 3. 详情与表单（B3.3）

- 排程详情对齐基线：`PageShell + PageHeader + InfoTile×4 + SectionTabs`，加载/空态改 `LoadingState` / `EmptyState`；按状态给 修改 / 删除 / 确认生产 / 纳入生产计划单；新增「打印点菜单」与「复制」。
- 新建与编辑共用一个 `ScheduleForm`：`PageShell + PageHeader + FormSection`，左侧已选菜品用 `PaperCard` 小票，右侧用 `PortionTag` / `CategoryTag`，搜索框去掉放大镜；**门店改为必选**；支持 `?copyFrom=` 回填（同日后续改为弹窗，标题改由门店+日期生成，见第 7 条）。
- 生产计划表单改为 `PageShell + PageHeader + FormSection`；来源选择器支持搜索、分页与「全选本页」，选中项用 Map 跨页保留；支持 `?scheduleId=` 预选；同类确认弹窗尺寸统一为 `compact`。

### 4. 完成生产与打印（B3.4）

- `complete-production-dialog`：三态按钮与汇总改 `--status-*` Token（原 `bg-green-50` / `bg-red-50` / `text-green-600`），未完成行底色从无效的 `bg-danger-muted` 改为 `--status-danger-bg`；新增行搜索；清掉 `portions === "" as unknown as number` 类型逃逸。
- 排程打印补 `?doc=menu`（门店点菜单：菜品编号/名称/份量/荤素/数量/售价/计划销售额 + 合计）。

### 5. 业务加固（B3.5，未改 schema）

- 删除 `PUT /api/schedules/[id]/complete`：该接口无前端调用方，却可绕过净菜入库事务把排程置「已完成」。排程「已完成」只由生产计划单完成后 `syncSourceScheduleStatuses()` 回写。
- 菜品去重：`createScheduleSchema` / `updateScheduleSchema` 加 `superRefine`；`buildCuttingOrders` / `buildPurchasePlans` 改为 `Map<dishId, qty>` 合并份数，不再只取第一行。
- `storeId` 去掉 `.default(1)`；创建时校验门店存在且未停用。
- 新增 `lib/shared/schedule-status.ts`（枚举值 + 选项元数据 + 取值解析 + 合法性判断 + variant）与渲染入口 `app/components/ui/schedule-status-tag.tsx`；zod 与列表筛选项从同一份导入。
- 排程详情「切配工单」Tab 在缺封装规格时给出警示，避免到完成生产才整单回滚。
- 业务运营开放 `/schedules`、`/production-plans` 页面读权限；写操作仍限管理员/厨师长，卡片与详情按 `canAccessApi` 隐藏写操作按钮。
- 新增 `lib/client/use-current-role.ts`。

### 6. 看板化与入口拆分（同日追加）

- 列表改为按状态三列看板：新增 `kanban-board.tsx`（列头状态 + 总张数、列内骨架与空列提示、单列超 100 张时的缩小范围提示）与 `date-preset-group.tsx`（抽出的日期快捷）。
- 取数改为按状态各取一列（`pageSize=100`），新增 `use-schedule-board.ts` 的 `useScheduleBoard` / `useProductionPlanBoard`；分页版 `use-schedule-list.ts` 删除。
- 生产计划单升为一级菜单「生产」：新增 `app/production-plans/page.tsx`，与排程页同构；`/schedules` 去掉模块切换，页面标题改为「菜品排程单」。侧边栏新增「生产」（`ClipboardList`）。
- 状态筛选下线（状态由列直接表达）；门店筛选只保留在菜品排程单。所有 `/schedules?tab=plans` 返回入口改为 `/production-plans`。

### 7. 状态列可视化与新建弹窗（同日再追加）

- 看板列头改为状态色卡头：`--status-*-bg` 底 + 状态图标 + 一句话说明（待生效=待确认可改可删 / 进行中=已确认等待切配入库 / 已完成=已入库仅可查看），列容器按状态色浅底，三列一眼可辨。
- 筛选按「搜索框 → 日期（单日）→ 门店」固定顺序，移除日期快捷与日期区间；生产计划单为搜索 → 日期。日期控件新增 `showWeekday`，触发器内直接显示星期。
- 新建菜品排程改为弹窗（`schedule-create-dialog.tsx`）：第一行门店 + 售卖日期，下方 3:7 分「已选菜品 / 菜品库」，完成即创建并跳详情。移除 `/schedules/new` 页面；看板通过 `?create=1` / `?copyFrom=<id>` 打开弹窗，卡片「复制」改为带数据开弹窗。
- 标题自动生成且不在表单展示，固定格式 `门店名称 · 周二（11月21日）·菜单`（`lib/shared/schedule-title.ts` + 测试）。
- 按钮文案「新建排程」改为「菜品排程」。

### 8. 视觉回退与弹窗对齐（同日再追加）

- **去掉拟物化**：删除 `app/components/ui/paper-card.tsx`、`paper-stamp.tsx`，移除 `globals.css` 的 `--doc-*` Token 与 `.doc-card-shadow`；基线 §6.1.1「单据卡片」与 §5 两行、迭代基础 §3.2 两行、`.agents/skills/ui-baseline` 的单据卡片章节、`/ui-kit` 四态样张全部同步移除。理由：用户反馈纸面与印章「非常难看且不直观」。
- 排程/生产计划卡片改用标准 `Card` + `StatusBadge`，信息压成「标题 + 状态 / 菜品·份数·日期 / 制单人·关联计划 / 操作区」四行，`ScheduleStatusTag` 只保留 badge 形态。
- 看板列的状态辨识改为**列头状态色 + 图标 + 一句话说明**，不依赖卡片材质。
- 编辑页左侧「已选菜品」同步改为带标题栏的普通面板。
- **新建弹窗对齐「创建净料」弹窗**：`AppDialogContent size="workbench"` + `p-0 flex flex-col max-h-[calc(100dvh-24px)]`，头部与底部带分隔线；第一行门店与售卖日期按 4:6 与下方两栏对齐，下方分区改为 **4:6**；两个区域各自带标题栏（已选菜品带「N 道 · M 份」，菜品库带搜索、分类与可选数量）。
- **日期控件**：`Calendar` 的 `locale` 由伪对象 `{ code: "zh-CN" }` 改为 date-fns 的 `zhCN`，弹层星期表头不再出现 `Su/Mo/Tu` 英文缩写；筛选占位文案改为「售卖日期」。
- 看板卡片不再重复展示状态（状态已由所在列表达）；日期触发器加 `whitespace-nowrap` 与 `shrink-0` 图标，弹窗内售卖日期固定 260px，选中后单行展示。

### 9. 标题派生、卡片收敛与预览弹窗（同日再追加）

- **标题改为派生字段**：`POST/PUT /api/schedules` 一律按 `门店名称 · 周几（月日）·菜单` 重算（`lib/shared/schedule-title.ts`），忽略客户端 `title`；新建弹窗与编辑表单都去掉标题输入项，卡片与打印副标题不再拼接门店名（标题已含门店）。存量标题用 `scripts/backfill-schedule-titles.mjs` 覆盖（本地库 4 条排程、更新 3 条；脚本默认只预览，`--apply` 才写库；生产库上线后需同样跑一次）。
- **卡片收敛**：去掉复制与编辑按钮、去掉「尚未纳入生产计划单」文案、卡片不再展示状态；底部左侧制单人、右侧只留一个主操作。进行中未纳入生产计划的按钮为禁用的「等待排产」，已纳入为「查看生产计划」。
- **点击卡片改为弹窗**：预览由 `RecordSheet` 抽屉改为 `AppDialogContent size="workbench"` 弹窗（与创建净料/小料表单同一壳），两张单据列表一致。
- **口径统一**：排程域内的「生产日期」全部改为「售卖日期」（详情 `InfoTile`、编辑表单、打印单头、切配/采购/菜单导出表头）；生产计划单仍用「生产日期」。

### 10. 生产模块按排程口径对齐（同日再追加）

- **新建改为弹窗**：新增 `production-plan-create-dialog.tsx`（`AppDialogContent size="workbench"`，与菜品排程同壳）：第一行生产日期，下方 **4:6** 分「已选排程单 / 可汇总排程单」，右侧带搜索、全选本页与分页；完成即创建并跳详情。删除 `/production-plans/new` 页面；排程详情「纳入生产计划单」改指向 `/production-plans?scheduleId=`，列表支持 `?create=1` / `?scheduleId=`。
- **标题改为派生字段**：`切配中心·周几（月日）生产计划`（`lib/shared/production-plan-title.ts` + 测试），创建与修改接口都忽略客户端 `title`；`ProductionPlanForm` 收敛为编辑专用并去掉标题输入。存量 2 张计划单标题用 `scripts/backfill-production-plan-titles.mjs --apply` 覆盖。
- **列表卡片**：已完成主操作改为「查看详情」，卡片不再放打印标签（收敛到详情页）；点击卡片打开与排程一致的 workbench 预览弹窗。
- 口径：计划单域仍用「生产日期」，排程域仍用「售卖日期」，两者不互串。

### 11. 生产模块明细调整（同日再追加）

- 计划单标题格式改为 `切配中心·周二（11月21日）生产计划`，存量 2 张按新格式再次覆盖。
- 新建弹窗第一行在「生产日期」右侧加「选择门店」（默认「所有门店」），只作为可汇总排程单的筛选条件，不改变计划单跨店汇总的属性。
- 列表卡片去掉计划编号（`PPL-日期-序号`），详情页与打印仍保留。
- 看板三列去掉状态底色：列容器统一为中性 `bg-muted/20`，状态只由列头的彩色图标、文字与一句话说明表达。

### 12. 工作台周视图与状态标签统一（同日收尾）

- 工作台由「单日复盘」改为**周视图**：表格式周历按日期列展示排程单与生产计划单，接入 `GET /api/dashboard/weekly`；周切换写回 URL（`?week=<周一日期>`），刷新或分享可回到同一周；窄屏横向滚动。
- 周历每格支持按日期直接新建：按权限（`canAccessApi`）打开排程/生产计划创建弹窗，创建成功后自动刷新；两个弹窗新增 `presetDate`。
- 删除已被周视图替代的 `GET /api/dashboard/daily` 与 `dashboardDailyQuerySchema`。
- `ScheduleStatusTag` 改为**中色系实底 + 白字**（`--status-warning/progress/done-solid`），排程列表、看板列头、创建弹窗选项、计划详情统一使用，不再与浅色 `StatusBadge` 混用；`--status-info-solid` / `--status-success-solid` 随之重命名为语义名。
- 个人菜单（个人信息 / 退出登录）移至工作台右上角，侧边栏只保留导航。

### 验证

- `npx tsc --noEmit` 0；`npm run lint` 0；`npm test` 49 套件 / 253 用例全绿（新增 schedule-status、schedule-schema、重复菜品聚合三组用例）；`npm run build` 通过。
- 未做浏览器实机目视：预览窗口没有登录态，已与用户确认先跳过。
- 未做（延后，需补测试后再动）：`buildProductionPlanData` 改用排程快照口径（G5）、生产入库台账按门店拆分写 `scheduleId/storeId`（G6）。两者都会改变既有口径，当前无 UI 验证且 `buildProductionPlanData` 无测试覆盖。

### 环境备忘

- 同目录只允许一个 `next dev`：接管预览前需先停掉既有 dev server（本轮停过 PID 19820，之后 3000 由预览进程托管）。
- 删除 `app/api/**/route.ts` 后，`.next/types/validator.ts` 会残留旧路由引用导致 tsc 报错；清理 `.next/types` 后重启 dev 即恢复。
- 工作区另有并行会话的「菜品状态短值化」改动（`dish-status.ts`、`dish-enums.ts`、迁移 `20261115233000`），与本轮无文件冲突。

---
---
## 2026-11-16 — 菜品库基本点交互优化

### 1. 列表主字段

- 菜品名称、售价改为与食材库一致的强调样式：`font-semibold text-primary`，售价保持 `tabular-nums`。

### 2. 创建完成落点

- 新建菜品保存草稿或发布成功后统一跳转 `/dishes`，不再落到旧查看页。

### 3. 菜品复制

- 新增 `POST /api/dishes/[id]/copy`：完整复制主档、四层 BOM 与工序，生成独立草稿；默认名称「源名称-副本」，重名自动追加序号。
- 列表操作列新增复制入口，弹窗可编辑新名称；提交后刷新列表。
- 复制与转化共用 `lib/server/dish-variant.ts` 的 `createDishVariant()`，复制倍率为 1。

### 4. 新建表单分组与估算成本

- 左侧保持原底层结构，拆为两个 `FormSection`：
  - 「基本信息」：菜品名称 + 份量（第一行）、售价 + 毛利（第二行）
  - 「菜品描述」：荤素类型置首，菜品类别/菜系/做法/口味/季节居中，菜品描述置尾
- 菜品描述改为单行输入框。
- 左侧信息区不再显示滚动条：保留滚动能力，用 `scrollbar-width:none` 与 `::-webkit-scrollbar` 隐藏，同时压缩左栏留白。
- 估算成本不在基本信息区单独展示，改为「菜品用量」模块标题处的主题色加粗数值。

### 5. BOM 用量口径

- 菜品 BOM 选择器隐藏「用量」输入；净料/小料直接采用档案封装规格 `packageSpec` 作为 `amountG`，其余类型回退 100g。
- BOM 行移除用量输入框，改为展示所选食材的份量标签（`PortionTag`）；调料/酱料无份量时显示占位符。
- `BomPickerDialog` 新增 `showAmountInput`（默认 true）与 `singleSelect`（默认 false）；菜品 BOM 传 `showAmountInput={false} singleSelect`，酱料配方编辑器保持原多选与用量输入。
- 选择弹窗去掉「取消」按钮，已选摘要 / 用量输入 / 确认选择统一收进底部操作行。
- 详情接口补 `netIngredient.portion`，编辑已有菜品时份量可正确回显。

### 6. 详情抽屉查看优化

- 抽屉宽度由 45% 调整为 2/3，基础信息改用 `DetailSection cols={4}` + `InfoCell`，一行 4 个标准字段。
- 菜品描述使用 `col-span-2 lg:col-span-4` 独占整行；`DetailSection` 新增 `cols`、`InfoCell` 新增 `className` 支持跨列。
- 售价与用料成本价使用 `emphasis` 主题色强调。

### 校验

- `npx tsc --noEmit`、`npm run lint`、`npm test`（48 套件 / 251 用例）、`npm run build` 全部通过。
- 最后一轮单行描述与隐藏滚动条改动后，菜品相关文件 eslint 通过、5 套件 15 用例通过；全量门禁因另一会话正在改造 `production-plans/new` 暂时不可用，待并行改动收口后重跑。
- 尝试启动预览服务实机验证，因无登录态停在登录页；表单与 BOM 行行为已由组件测试覆盖。



### 背景

菜品库进入功能与交互迭代。本轮先只推进数据与接口逻辑，页面布局与视觉交互单独处理，因此列表/详情的外观未改。

### 1. 状态机收敛为三态

- `Dish.status` 取值统一为 `draft / published / inactive`，`pending` 废弃；迁移 `20261115233000_normalize_dish_status_pending` 将存量 `pending` 归一到 `draft`（显式映射，零结构差异）。
- 新增 `lib/shared/dish-status.ts`：枚举值、选项元数据、解析/校验、动作迁移表（publish / unpublish / deactivate / restore）。
- 新增 `POST /api/dishes/[id]/status`：服务端校验发布完整性，事务内按当前状态条件更新，重复调用幂等，并发变更返回 409。
- 只有草稿可编辑；`PUT /api/dishes/[id]`、BOM、工序接口对已发布/已停用统一拒绝。
- 发布校验抽到 `lib/shared/dish-publish.ts`，前端 `validateDishDetailForPublish` 与服务端共用；新建接口强制 `draft`。

### 2. 上下游保护

- 删除菜品前检查 `ScheduleItem` 引用，被引用返回 409 并提示改为停用。
- 新建排程只允许已发布菜品；编辑排程允许保留原排程中的已停用菜品，但不可新增。
- 排程详情补 `dish.status`；编辑页菜品下拉改为 `status=published&pageSize=100`。
- 工作台日报成本改用 `getCurrentDishCostMap()`，与列表/详情同一实时口径。

### 3. 详情聚合与成本拆分

- `lib/server/dish-costing.ts` 新增 `getCurrentDishCostBreakdownMap()`，返回主料/辅料/小料/调料/酱料五类小计与合计；`getCurrentDishCostMap()` 变为取 total 的包装。
- `GET /api/dishes/[id]` 增加 `costBreakdown`、`bomSummary`、`scheduleRefCount`、最近 5 条 `scheduleRefs`，供后续详情抽屉直接消费。

### 4. 菜品转化通用化

- 移除「仅小碗菜可转化」限制，任意份量档案可作为源；目标份量必须来自 `PORTION_VALUES` 且与源不同。
- 新档案默认命名「源基础名称·目标份量」，由 `stripPortionSuffix` / `buildPortionName` 避免后缀叠加；支持入参覆盖。
- 成本按当前食材价重算后缩放；同类别、同名、同份量已存在返回 409。

### 5. 校验与遗留

- `npx tsc --noEmit`、`npm run lint`、`npm test`（40 套件 / 219 用例）、`npm run build`、Prisma 零差异校验全部通过。
- 页面级交互与视觉（列表筛选、详情抽屉重构、转化弹窗信息结构、`/dishes/[id]` 重定向）留到交互专项，不在本轮改动。



### 背景
试运行反馈对食材库提三点要求：档案要有创建时间（不进列表，放详情页顶部）；首页计价规则收进弹窗、5 个清单上下居中；小料清单主字段显示不符合规范。

### 1. 建档时间

- **Schema**：`ingredients` 表新增 `created_at`（原料 + 调料同表）。迁移 `20261115213000_add_created_at_to_ingredients` 三步走：先加可空列 → 存量回填初始建库日 `2026-10-26 11:32:10` → 再改 `NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`。存量行不拿假的建档时间，新建的记真实时间。
- **净料/小料（`net_ingredients`）与酱料（`sauce_ingredients`）已有 `created_at`**，无需迁移。
- **展示位置**：详情页顶部、关闭按钮下方，显示「建档 YYYY-MM-DD HH:mm」。原料/调料/净料/小料走 `RecordSheet`，酱料走其自带的新增/编辑弹窗。
- **列表不展示**：5 个清单均不出现创建时间列；酱料列表原有的「更新时间」列按决定保留。
- **通用件**：`RecordSheet` 新增 `headerAside` 槽位（关闭按钮下方的辅助信息）；`lib/shared/display-format.ts` 新增 `formatDateTime()`。

### 2. 食材库首页

- 「计价规则」从页面底部的常驻大卡片收进弹窗（`AppDialogContent size="wide"`），入口按钮放在**标题行右上角**（`PageHeader` 的 `actions` 槽位）。
- 5 个食材清单的主体展示：页面回到自然排布（不锁 `h-dvh`），流程图跟在标题行下方 `mt-10`；各列卡片由 `justify-between` 改为 `justify-center + gap-8`，使 5 个清单在流程图内上下居中成组。

### 3. 小料清单主字段

- 「名称」列由 `font-medium` 改为 `font-semibold text-primary`，与净料一致（主字段必须加粗 + 主题色）。
- 列顺序调整为「序号 → 编号 → 名称 → 二级分类」，与其余 4 个清单的主字段位置一致。

### 顺带清掉的基线欠账

食材库模块 lint 告警清零（全站 19 → 12，剩余 12 条全在 `app/settings/**`）：原料删除确认、酱料表单与删除确认改用 `AppDialogContent` 语义尺寸；首页 3 处 <12px 字号改 `text-xs`；首页数据获取 effect 按 React 官方推荐模式加块级精确豁免。

### 部署审计（本轮含 schema 变更）

- **迁移**：仅 `20261115213000_add_created_at_to_ingredients`，只对 `ingredients` 表 ADD COLUMN + UPDATE 回填，**无 DELETE、不触碰其它表**。
- **seed**：`prisma/seed.ts` 只写分类字典，**不写 ingredients**，无覆盖风险。
- **零差异**：`migrate diff --from-migrations --to-schema` 输出空迁移；本地 MySQL 已 `migrate deploy` 实测通过（NOT NULL 约束即证明无残留 NULL）。

### 验证

- `npx tsc --noEmit` 0 错误；`npm run lint` 0 error / 12 warning（全部在 settings）；`npm test` 37 套件 / 206 用例全绿（新增 `formatDateTime` 用例）。
- 待补：浏览器实测（首页计价规则弹窗、5 清单居中、详情页建档时间、小料主字段）。

---
---
## 2026-11-15（续 4）— 食材库迭代总结 + 全系统迭代升级基础

### 背景
食材库在试运行第一周先行迭代（提交 `c49d17a`），做了份量枚举统一、存量口径迁移、5 个清单收口、档案复制、删除入口收敛、保存并继续添加 6 件事。但这些经验只沉淀在食材模块里：`PortionTag` 被 `dish-form` 跨目录引用、列表页规则写在基线文档的「食材清单」专节、复制与连续录入的编排在各页面重复实现。下一轮改造设置/库存/排程/生产计划时，同一批决策会被重新发明。

### 本轮产出
**文档**
- 新建 `docs/ingredient-library-iteration-review-2026-11.md` — 食材库本轮总结（6 件事逐项 + 沉淀通用件 + 踩坑 + 验证结论）
- 新建 `docs/system-iteration-foundation-v1.md` — 全系统迭代升级基础总纲：六条通用契约（C1 枚举字典 / C2 列表页 / C3 详情抽屉 / C4 档案复制 / C5 连续录入 / C6 存量口径迁移）、通用件唯一入口对照表、通用模块骨架、批次路线、门禁
- 升级 `docs/interaction-visual-baseline-v1.md`：原「6.2.1 食材清单」拆成通用条款（列表页 / 详情抽屉 / 档案复制 / 连续录入）+ 收窄后的食材专有条款；§5 组件契约表补 5 条；§6.1 补列表页契约；§9 治理规则补 4 条检查点
- 更新 `docs/interaction-visual-baseline-v1-rollout-plan.md`：批次状态、剩余项归属、新增批次 5 = 设置模块

**代码（通用件提升）**
- `app/components/ui/portion-tag.tsx` — 从 `app/components/ingredients/` 提升（消除跨业务域引用）
- `app/components/ui/detail-section.tsx` — `DetailSection` / `InfoCell`，从食材详情抽屉提取
- `app/components/ui/use-record-guard.ts` + `discard-changes-dialog.tsx` — 未保存改动拦截，从食材详情抽屉提取
- `lib/client/use-record-copy.ts` — `useRecordCopy`，统一复制编排（回填 + 名称后缀 + 弹窗叠放 + 提交后全关）
- `app/components/ui/use-record-form.ts` — 新增 `clearOnContinue` / `keepOnContinue` 与 `submitContinue`，连续录入策略从业务 hook 的标志位移到通用层
- `lib/shared/portion-scale.ts` — 补导出 `PORTION_OPTION_BY_VALUE`
- 通用层自身违规清理：`select-dialog.tsx` / `import-dialog.tsx` / `select-table-mode.tsx` 三处像素宽度弹窗改 `AppDialogContent` 语义尺寸，`SelectDialog` 增 `size` 属性
- 原料 / 净料 / 小料 / 调料 4 个清单页改用 `useRecordCopy`

**Skill**
- 改 `ui-baseline`：新增「详情 / 复制 / 连续录入 / 枚举口径」四节，列表节补字段标题不带单位、整行进详情、操作列不折叠
- 改 `domain-pricing`：份量段补枚举字典契约与存量迁移套路
- 新建 `module-iteration`：主数据模块的施工顺序（对齐口径 → 列表页 → 详情抽屉 → 复制 → 连续录入 → API 契约 → 样张验收）+ 反模式表；`.claude/skills/module-iteration` 已建链接
- `.agents/skills/README.md` 清单表补一行

### 明确不做的抽象
- 不抽通用列表页骨架组件：5 个清单的差异集中在 columns / rowActions / 附加弹窗，抽成骨架要把差异硬塞进 props；等设置、库存两批改造完再评估
- 不抽枚举字典工厂函数：目前只有 1 份字典，用目录约定 + 文档契约 + Skill 约束代替
- 不改任何数据库 schema，零迁移、零生产影响

### 下一批
设置模块（`app/settings/` 7 页）—— 与食材库同构度最高、是剩余 12 条 lint 告警集中区、纯主数据风险低。采购模块因 `TRIAL_FEATURES.purchases = false` 锁定，不能打头。批次路线：设置 → 库存 → 排程 + 生产计划 → 菜品 → 采购（解锁后）。

### 验证
- 新增单测：`use-record-copy` / `use-record-form` 连续录入 / `detail-section` / `discard-changes-dialog` / `use-record-guard`
- `npx tsc --noEmit` 0 错误；`npm run lint` 不新增告警；`npm test` 全绿；`npm run build` 通过；Prisma 零差异
- 回归：食材 5 清单（筛选 / 分页汇总 / 每页条数 / 复制 / 编辑 / 删除入口 / 保存并继续添加）+ 菜品 BOM 选择器份量列

---
---
## 2026-11-15（续 3）— ACR 镜像部署通路首次实测通过

### 背景
此前的生产部署走服务器现场构建；ACR 变量与 Secrets 虽已配置，但通路一直未实测。本次按用户要求改走 ACR。

### 部署前审计
- **迁移**：本次仅新增 `20261115100000_add_portion_to_net_ingredients`（`net_ingredients.portion` 加列 + 两条 `UPDATE dishes` 份量重命名）。生产盘点 `dishes.portion` 仅「单人份×3 / 一锅10份×1」，全部在迁移覆盖范围内，无枚举外取值。
- **seed**：仅补缺失字典与基线；唯一固定写入是停用 `SEA-SEA`（幂等），不触碰菜品、食材与BOM。
- **基线**：记录 14 张关键表行数（原料 51 / 净料 77 / 菜品 4 / BOM 16+9+1+0 / 排程 3 / 生产计划 3 / 净菜库存 5 / 出库单 1 / 单位 21 / 门店 2 / 包装 7）。

### 部署
- `workflow_dispatch` 触发 `deploy.yml`，run `43710678216`，head `a55089a`
- build 推送 web / migrate 两镜像至 ACR → deploy-prebuilt 拉取并重启 → health 通过；`deploy-server`（现场构建）按条件跳过
- 服务器 git HEAD `a55089a`；web 镜像为 `.../lean-kitchen/lean-kms-web:a55089a...`；migrate 容器 `Exited (0)`

### 验证
- 迁移 `20261115100000` 已应用
- `dishes.portion`：小碗菜×3、小碗菜·10份×1，与迁移映射一致
- `net_ingredients.portion` 列存在，77 条存量均为 NULL（符合设计）
- 14 张关键表行数与部署前完全一致，差异 0
- `/login` HTTP 200；web 日志无错误

### 结论
ACR 通路可用，后续部署默认走镜像拉取；现场构建仅作为未配置 ACR 时的兜底。

---
---
## 2026-11-15（续 2）— 旧原料库存表下线：代码层清理完成，删表待排期

### 背景
生产库 `inventory` / `inventory_ledger` **各 0 行**，是 v002 净菜库存改版后遗留的空表。清理前先做引用扫描，发现**两表仍被活跃代码引用**，直接 DROP 会导致运行时崩溃。

### 已完成（提交 7c79754，4 文件，-118 行）
| 位置 | 处理 |
|---|---|
| `app/api/purchase-receipts/[id]/route.ts` | 作废 / 编辑 / 保存三处旧库存读写全部移除；**保留**原料参考价（`latestRefPrice` / `pricePerJin`）维护 |
| `app/api/purchase-reimbursements/route.ts` | 移除报销结算对旧台账结算状态的标记 |
| `lib/server/unit-references.ts` | 移除「库存 / 库存流水」两个引用维度 —— 这项**必须做**：`/api/units` 的引用校验是活路径，删表后不清理会 500 |
| `lib/server/__tests__/schedule-utils.test.ts` | 清理 `inventory` mock（`schedule-utils` 本身已不访问库存） |

验证：tsc 0 错误 · eslint 0 错误 · jest 31 套件 171 用例全通过。

### 未完成：删表（schema + 迁移）—— 待排期
**原因**：删表必须与 `prisma/schema.prisma` 严格同步（零差异校验要求迁移历史与 schema 一致）。当前另一会话正在同一工作区迭代「净料份量」，正在修改 `schema.prisma`（`NetIngredient.portion` 新增 + `Dish.portion` 默认值调整）且尚未提交。此时改 schema 存在「最后写入覆盖」风险——它随后保存会覆盖掉删除，而迁移已 DROP 表，将造成 schema 与库不一致。

**执行步骤（届时约 5 分钟）**：
1. 删除 `prisma/schema.prisma` 中的 `model Inventory` 与 `model InventoryLedger` 两个块
2. 新建迁移 `prisma/migrations/<ts>_drop_legacy_inventory_tables/migration.sql`：
   ```sql
   DROP TABLE IF EXISTS `inventory_ledger`;
   DROP TABLE IF EXISTS `inventory`;
   ```
3. 同步 `memory-bank/Database.md` 的总表清单（24 → 22 张）与 5.3 / 5.4 两节
4. 验证：`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 必须输出空迁移；`npx tsc --noEmit`；`npm test`
5. 提交并部署（migrate 服务自动应用）

**风险评估**：两表 0 行，采购单表亦为 0 行，采购链路在试运行期间被 `TRIAL_FEATURES.purchases` 锁定不可达 → 删表无数据风险。

---
---
## 2026-11-15（续）— 交互基线批次 1 / 3 / 4①② 落地

> 与「食材模块新一轮迭代」并行推进，**范围刻意排除 `app/ingredients/**` 与 `app/settings/**`**，避免与另一会话抢同一批文件。

### 批次 1：弹窗语义尺寸 + 字号下限（提交 9a3d807，17 文件）
- 13 处业务弹窗改用 `AppDialogContent` 语义尺寸；尺寸映射按**有无输入字段**判定（460px 含输入框 → form，440px 纯文字 → compact），非纯像素数
- 16 处 `text-[9px]/[10px]/[11px]` → `text-xs`
- 清理改用 AppDialogContent 后未使用的 `DialogContent` import
- `components/ui/calendar.tsx`：保留 shadcn 官方模板的 `as any`，加文件级 eslint-disable 说明（该目录由 CLI 管理，不做类型重构）
- `scripts/audit-schedule.ts`：删除未使用的 `srcIds` 死代码

### 批次 3：React Hooks 规范化（提交 c025b67，11 文件）
- 2 处「props 变化重置本地状态」→ React 官方「渲染期调整」模式
- 1 处 URL query 切 Tab → `startTransition`
- 1 处 `immutability` → `fetchData` 声明提到 effect 之前
- 8 处数据获取 effect → 成对 `eslint-disable/enable` 精确豁免 + 注明依据（React 官方推荐模式，setState 均在 await 之后）

### 批次 4 动作①②
- `calendar.tsx` 的 any、`audit-schedule.ts` 死代码 —— 已随批次 1 一并完成
- 动作③（规则 warn → error 升档）待批次 1/3 存量清零后执行

### 结果
- **lint 62 → 21 警告，0 错误**；剩余 21 处全部在 `app/ingredients/**`(9) 与 `app/settings/**`(12)，随对应模块迭代消化
- tsc 0 错误；jest 157/158（唯一失败为 `ingredients/__tests__/net-ingredient-form-dialog.test.tsx`，属并行迭代的净料表单改动，与本次无关）

### 协作要点（已验证有效）
- 与另一会话同工作区并行时，**一律用精确路径 `git add`，禁止 `git add -A`**，否则会把他人的中间态一并提交
- 另一会话的中间态会让全局 tsc/jest 短暂失败，验证时按「错误是否涉及我的文件」判定，而非直接采信全局结果

---
---
## 2026-11-15 — 食材模块新一轮迭代（原料清单 + 净料份量体系）

### 背景
试运行第一周反馈后的食材模块迭代，五项需求：原料清单底部组件补齐、最新参照单价去单位、新增原料分组配色、保存并继续添加、净料份量字段。

### 份量口径（唯一真源 `lib/shared/portion-scale.ts`）
- 枚举：小碗菜 / 小碗菜·10份 / 社区·2份 / 社区·3份 / 社区·4份
- 小碗菜等价份数：1 / 10 / 4 / 6 / 8；菜品「转化份量」倍率按此推导（社区·2份 → 小碗菜 = ×0.25）
- 净料、小料与菜品共用同一套枚举，建档时不会填错口径
- 落库存短值（如 `社区·2份`），括号内容只作描述文案
- 存量净料/小料份量留空（列表显示「—」），新建与转净料必填，编辑存量允许留空

### 交付内容
- **Schema**：net_ingredients 加 `portion`（可空）；迁移 `20261115100000_add_portion_to_net_ingredients` 同时把存量菜品 `单人份 → 小碗菜`、`一锅10份 → 小碗菜·10份`，dishes.portion 默认值改为「小碗菜」
- **API**：净料 POST 份量必填（zod enum，缺值 400「请选择份量」）；PUT 未传保持原值、显式传 null 清空；列表/详情随行返回
- **表单**：转净料 / 新增净料 / 编辑净料 / 新增小料 / 编辑小料 的「规格指标」分组新增必填份量字段（SelectTileMode，附等价份数说明）
- **展示**：净料/小料详情抽屉「包装与规格」分组展示份量；列表页不设份量列；菜品 BOM 选择器弹窗的净料/小料行以标签展示份量
- **食材清单**：原料、净料、小料、调料、酱料 5 个清单底部统一展示数据区间汇总与每页条数（Pagination 新增可选 totalLabel / showPageSize，默认关闭）；最新参照单价去掉单位后缀（采购单位另有列，调料清单同步）
- **保存并继续添加**：新增原料弹窗新增 outline 按钮，保存后保留分类与单位、清空名称/品牌/价格/供应商并把焦点回到名称框
- **档案复制与删除收敛**：原料/净料/小料/调料/酱料支持以现有档案为模板复制（名称追加「-副本」避免重名拦截，提交按新建处理）；删除入口统一收敛到详情页（酱料在编辑弹窗底部），列表操作列只保留复制与编辑
- **交互基线**：食材库 5 个清单的汇总与每页条数已在 docs/interaction-visual-baseline-v1.md 登记为统一口径；表单分组仍只用边框与标题，不使用浅色背景

### 验证
- `npx tsc --noEmit` 0 错误；`npm run lint` 0 error（19 warning 为存量基线告警）；`npm test` 33 套件 / 187 用例全过；`npm run build` 通过
- `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 输出空迁移（零差异）
- 接口冒烟：缺份量 → 400「请选择份量」；非法枚举 → 400；合法枚举 → 201 且份量落库；存量菜品份量已迁移为「小碗菜」

---
---
## 2026-11-15 — 首次生产部署与数据安全验证

### 部署前审计（回应「不要动食材和菜品数据」）
- 逐行审计新增迁移 `20261114090000_add_net_packagings`：只有 `CREATE TABLE net_packagings` + 两条 `INSERT IGNORE`，**无任何 UPDATE/DELETE 业务表**
- 逐行审计 `prisma/seed.ts` 全部写操作（生产 `migrate` 服务实际执行 `prisma migrate deploy && prisma db seed`）
- 部署前生产库只读盘点：原料 48 / 净料小料 70 / 菜品 4 / BOM 16+9 / 排程 3 / 生产计划单 3 / 净菜库存 5 / 出库单 1

### 修复 seed 覆盖隐患（提交 623ae91）
- 单位：改为仅缺失时创建、系数为空时补齐，**不再覆盖运营改过的换算系数**
- 门店：仅缺失时创建，不再覆盖 code / isSystem / 启用状态
- 净菜包装基线：仅缺失时创建，不再复活运营停用/软删除的包装
- 本地库实测：造「斤=490g、门店改码、密封袋停用」场景跑 seed，三项均未被覆盖；造「系数 NULL、包装行删除」场景，均被正确补齐/重建；测试后本地库已还原

### 生产盘点结论：封装规格待办实际不存在
- 生产 70 条净料/小料 `package_spec` **全部有效**（5g~2000g，0 NULL/0/负值），分布有真实区分度（非默认值批量填充）
- `progress.md` 中「存量净料/小料需补齐 packageSpec」的历史待办**关闭**；原方案文档保留为备查

### 部署
- 生产 HEAD 由 68a905d → 623ae91，`migrate` 容器 Exited(0)，迁移已应用，seed 完成，web Up 且 healthy
- **数据零变化验证**：部署前后 25 项基线逐行比对（各表行数 + 原料/净料/菜品/BOM/units/stores/cats_l2 内容 MD5 指纹）**差异 0 行**

### 协作规范
- 新增 `docs/协作错误清单.md`：记录 7 条重大协作错误（ACR 配置误判、长命令静默、数据比对假警报、stderr 被吞、seed 审计滞后、继承未复核的历史结论、缺阶段性汇报）与对应改正动作

### 遗留
- ACR 镜像通路**尚未实测**（本次触发 run #27 但 build 未完成即中止，按决定留待下次验证；GitHub 侧 ACR_REGISTRY / ACR_NAMESPACE / Secrets 均已就绪）
- 交互基线 62 条 lint warning 待分批清理
- 生产库 `inventory` / `inventory_ledger` 旧表已停用未清理

---
---
## 2026-11-14 — 净菜包装字典、交互视觉基线落地与文档校正

> 本次为试运行上线后的第一轮整理：把两周内积累的两条并行工作线（净菜包装字典 / 交互视觉基线落地）拆分提交，并校正全部过时文档。

### 提交拆分

工作区累计 84 个改动文件 + 38 个新增文件，按语义拆成 3 次提交，便于回溯与回滚：

| 提交 | 内容 | 文件数 |
|---|---|---|
| `feat(ingredients): 净菜包装字典与净料价格口径统一` | schema + 迁移 + `net_packagings` 接口 + 价格口径统一 + 菜品成本实时重算 | 25 |
| `feat(ui): 交互视觉基线 v1 落地与净菜包装前端接入` | 业务组件层、食材模块重构、页面骨架、包装字典前端、`/ui-kit` | 94 |
| `docs: 校正项目文档过时内容并补充改造计划` | `CLAUDE.md` / `README.md` / `Router.md` / `progress.md` + 两份新计划 | 6 |

### 净菜包装字典（提交一、二）

- 新增 `net_packagings` 字典表（包装名称 + 尺寸，唯一约束 `(name, size)`）与 `/api/net-packagings`
- 设置模块新增「净菜包装」页，位于单位之前；设置首页固定四列（仅 Web 桌面端）
- 支持新增、编辑、启停、软删除；被净料/小料引用时删除与改名/改尺寸被拦截
- 净料、小料、转净料表单用「包装」下拉替换原包装物料/尺寸自由文本；停用包装不可新选，但编辑存量档案时仍可显示并保留
- `packageSpec(g)` 仍单独填写，不纳入包装字典
- 迁移 `20261114090000_add_net_packagings` 已应用，存量包装组合已回填

### 价格口径统一（提交一）

- 净料单价**强制**由来源原料实时价格派生（服务端忽略客户端传入的 `unitPrice` / `autoCalculate`）
- 净料/小料/酱料毛利率空值统一按 0 处理
- 新增 `lib/server/dish-costing.ts`：菜品成本按当前食材价格实时重算，替代 `Dish.cost` 历史快照；菜品列表、菜品详情、排程详情均已接入
- 出库价、酱料配方成本、BOM 成本全部改为走同一价格派生函数，消除多份重复实现

### 交互视觉基线 v1 落地（提交二）

- 抽取业务组件层：`PageShell` / `PageHeader` / `AppDialogContent` / `FormField` / `FormSection` / `ListToolbar` / `DataTable` / `StatusBadge` / `InfoTile` / `SectionTabs` / `EmptyState` / `LoadingState` / `RecordSheet` / `FormControls` / `useRecordForm`
- 食材模块重构：5 类清单 + 半屏详情抽屉（50vw）+ 表单 Hook 化（`use-ingredient-form` / `use-net-ingredient-form`）
- 列表分页统一为「上一页 / 当前页 / 下一页」，去除每页条数选择与数据区间展示
- 新增 `/ui-kit` 可视验收页 + 10 个组件单测
- ESLint 增加交互基线规则（弹窗语义尺寸、正文不小于 12px）
- 基线文档：`docs/interaction-visual-baseline-v1.md`（历史规范文档一律作废）

### 文档校正（提交三）

| 文档 | 修正内容 |
|---|---|
| `CLAUDE.md` | `middleware.ts` → `proxy.ts`（Next 16 更名）；删除「SESSION_SECRET 硬编码兜底」错误警告（实际为启动即强制校验）；Prisma 适配器改为 `PrismaMariaDb`；删除「无 zod 校验」「where 用 any」等过时技术债；库存章节改为 v002 净菜库存；补充菜品成本口径与命令表 |
| `README.md` | 表数量 25 → 34；模块状态表补生产计划单 / 净菜库存 / 包装字典 / 交互基线；命令表改为 `migrate dev / deploy` 并补零差异校验；补两份新文档索引 |
| `memory-bank/Router.md` | 按当前 `page.tsx` 全量重写：7 模块 40 页面、生产计划单与 v002 库存补齐、设置模块 7 子页、采购锁定标注、侧边栏 7 项 |
| `memory-bank/progress.md` | 本条 |

### 新增计划文档

- `docs/interaction-visual-baseline-v1-rollout-plan.md`：交互基线落地批次 1–4 与 62 条 lint 清理专项（弹窗像素宽度 31 / 字号 16 / React Hooks 13 / any 与未使用变量 2）
- `docs/production-data-package-spec-plan.md`：存量净料小料「封装规格」补齐方案（只读盘点 → 人工确认 → 幂等回填 → 校验 → 回滚）

### 验证

- `npx tsc --noEmit` 0 错误
- `npm run lint` 0 error / 62 warning（基线改造前的存量告警，已分批纳入计划）
- `npm test` 28 套件 / 158 用例全通过
- `npm run build` 通过（含 `prisma generate`）
- `npx prisma migrate status` 29 个迁移已应用，库结构最新
- `npx prisma migrate diff --from-migrations ... --to-schema ...` 输出空迁移（零差异）

### 遗留待办

1. **生产数据**：存量净料/小料 `package_spec` 未回填 → 完成生产抛错整单回滚、出库金额算成 0。方案见 `docs/production-data-package-spec-plan.md`，待执行
2. **交互基线**：剩余 62 条 lint warning 与未迁移页面，按批次计划推进
3. **旧库存表**：`inventory` / `inventory_ledger` 已停用未清理
4. **采购模块**：试运行锁定，尚未在生产验证完整链路

---
---
## 2026-11-12 — 排程到库存流程细节优化

### 状态与完成规则
- 门店排程单只在整张生产计划单完成且库存入库事务提交后转为「已完成」
- 部分来源排程切配完成但计划仍有待确认行时，全部来源排程保持「进行中」
- 「未完成」作为当日终态，允许计划与来源排程完成；出库与销售回录不参与状态判断

### 门店排程列表
- 卡片标题改为「门店名称 · 排程标题」，单行截断并保留完整标题提示
- 下方元信息不再重复展示门店
- 已关联生产计划时展示可点击的「生产计划 PPL-...」，点击不会触发卡片预览

### 切配确认
- 删除生产计划详情 Tab 上方的独立切配确认进度表
- 切配 Tab 内仅保留已完成/未完成/待确认的一行汇总
- 切配明细内直接展示实际完成份数、确认结果和备注
- 完成生产仍通过右上角批量确认弹窗提交，不在表格内直接触发库存变更

### 门店排程 Tab
- 生产计划详情新增「门店排程」Tab，按门店分组并逐张展示来源排程
- 门店内展示排程编号、名称、日期、实时状态和菜单
- 菜单字段限定为序号、菜品名称、份量、荤素、菜品编号、数量
- 新增 `ProductionPlan.sourceScheduleJson` 固化生成时门店菜单快照；来源状态仍实时读取

### 数据与验证
- 迁移 `20261112150000_add_production_plan_source_snapshot` 已应用
- `scripts/backfill-production-plan-source-snapshot.mjs --apply` 已回填存量 PPL-20261110-002
- 实测部分确认时计划/排程均为进行中，全部终态后在同一事务内变为已完成
- 自动验证数据已清理
- tsc、Lint（0 errors）、Jest 112/112、build、Prisma 零差异迁移检查全部通过

---
---
## 2026-11-11 — 排程状态闭环与核心流程优化

### 用户确认口径
- 不新增任何单据状态：门店排程单、生产计划单均严格保持「待生效 / 进行中 / 已完成」
- 生产计划单日期与来源排程日期不强制一致，允许跨日期汇总
- 切配确认进度模块保持原位置与原样，不并入 Tab

### 状态与数据一致性
- 生产计划单完成时，按来源排程切配工单终态在同一事务内同步门店排程状态；全部切配行终态后来源排程同步「已完成」
- 同一门店排程只允许纳入一个未删除的生产计划单；创建/修改均使用事务行锁校验，重复汇总返回 409
- 排程确认/修改/删除、生产计划确认/修改/删除、完成生产接入事务行锁或锁定记录，状态冲突不再产生半更新
- 修正实际完成份数为 0 时无法提交完成的问题
- 生产计划单待生效阶段支持修改标题、日期和来源排程；修改时重新生成共享的快照与编号

### 交互与页面
- 门店排程卡片/预览/详情展示所属生产计划；未纳入计划时提供新增生产计划入口
- 门店排程与生产计划卡片点击均进入标准 Sheet 预览，详情按钮独立
- 生产计划列表补齐搜索防抖、分页和预览交互
- 排程确认、生产计划确认使用标准 Dialog；删除提示补充来源排程释放说明
- 状态颜色调整：待生效警示色、进行中主题色、已完成成功色
- 门店排程日期筛选改为按生产日期 `scheduleDate`，不再按创建时间
- 修正生产计划快照行缺少数据库 id 时的 React 列表 key 警告

### 历史数据审计
- 新增 `scripts/audit-production-plan-schedules.mjs`，默认只审计，确认后使用 `--apply`
- 本地审计发现 1 张异常：`SCH-20261107-001` 来源计划 `PPL-20261110-002` 已完成，但排程仍为进行中
- 经用户确认执行 `--apply`，已将该排程修复为「已完成」；复查异常数量为 0

### 验证
- `npx tsc --noEmit` 通过
- `npm run lint` 0 errors（14 个存量 warning）
- Jest 96/97 通过；唯一失败为存量 `middleware.test.ts` 用例，与本次改动无关
- API 实测：重复汇总 409、待生效修改跨日期成功、编号随日期重算、删除计划释放排程、完成生产后计划与来源排程均变为已完成
- 自动验证数据已全部清理

---
---
## 2026-11-10（补）— 列表页卡片布局优化

- 模块切换（排程单/生产计划单）与操作按钮右对齐
- 卡片重构：不显示编号；状态徽标右上方且字号与标题一致；制单人+预览/详情右下方；点击卡片=预览抽屉；「快速查看」更名「预览」
- 已删除验证用测试数据（PPL-20261110-001）

---

---
## 2026-11-10 — 切配中心生产计划单（跨店汇总）完整落地

### 数据模型（迁移 20261110090000_add_production_plan）
- ProductionPlan：code（PPL-日期-序号）/ title / planDate / status（与排程单一致：待生效→进行中→已完成）/ operator / cuttingJson+purchaseJson（汇总快照，生成时固化）/ 软删除
- ProductionPlanSchedule：planId+scheduleId 溯源关联（唯一）

### 汇总口径（用户确认）
- 与门店有关字段一律不显示（列表/详情/选择器均无门店）；无门店分布行
- 切配按净料跨店合并：用量相加、份数=合并量÷封装规格重算（formatPortions）、毛料经来源原料取汇总采购行
- 采购按食材合并毛需求（克相加）；不做库存抵扣（库存模块改版中，表格显示「—」）；采购量按三条取整规则重算；预估金额=采购口径金额
- 系统内展示复用排程单表格组件（ScheduleCuttingTable/SchedulePurchaseTable）；打印/CSV 沿用今天定版格式（切配含☐完成状态、采购量留白、按供应商拆单）

### 交付物
- lib/server/production-plan-utils.ts（汇总计算）+ schemas/production-plan.ts
- API：/api/production-plans（GET 分页/POST 创建，仅可汇总「进行中」排程单）+ /[id]（GET/DELETE 仅待生效）+ /[id]/activate + /[id]/complete，均记操作日志
- 页面：/schedules 顶部「排程单|生产计划单」模块切换 + /production-plans/new（标题+日期+进行中排程单多选）+ /production-plans/[id]（信息卡+两 Tab+状态流转+删除确认弹窗）+ /production-plans/[id]/print（切配/采购两种单据，采购按供应商拆单）
- 端到端验证：汇总计算实测（前瘦1500g/2.4斤/2份+100g、螺丝椒3斤→1箱）+ 真实创建 PPL-20261110-001 + 页面截图验证

### 检查
- tsc / build / lint（0 errors）/ jest 全过；迁移零差异（empty migration 验证过）

---
---
## 2026-11-10 — 切配/采购单据打印导出字段定版 + 打印侧边栏 BUG 修复

### 切配工单（打印/CSV，页面表格不变）
- 字段：序号、名称、切配份数、净料用量（原「切配量」文案）、毛料用量（斤）（新增：经净料来源原料关联采购计划 grossNeed÷500，detail 组装时计算 grossNeedJin）、完成状态（空栏 ☐ 供纸质打钩）
- CSV 与打印列一致；打印改为平铺行（不再按分类分组）

### 采购计划单（打印/CSV）
- 字段：序号、食材名称、采购规格、毛料用量（斤）（原「毛料需求」改名）、库存扣减、采购量（原「建议采购量」改名、留白供手写实际采购量）、采购单位
- 去掉分类分组/编号/供应商/预估金额列与合计行；库存充足行置灰保留

### 打印 BUG 修复
- 现象：打印页带出系统侧边栏。全局 globals.css 的 @media print 规则未生效 → 改为打印页内联 style（body aside display:none / body main margin-left:0），print media 截图验证侧边栏消失、单据顶格
- 验证方式：tsx 生成测试 session cookie + Playwright emulateMedia print 截图

### 检查
- tsc / build / lint（0 errors，10 warnings）全过；数据链路实测（蒜米 0.2 斤、前瘦 1.6 斤、螺丝椒 2 斤与采购计划一致）

---
---
## 2026-11-08 — 列表排序核实 + 制单人文案统一 + 删除确认弹窗标准化

- 列表/详情页「负责人」文案统一改为「制单人」
- 详情页删除二次确认由原生 confirm() 改为标准 Dialog（复用菜品库删除弹窗模式，UxAudit S3 关闭）
- 列表排序经核实代码为 createdAt desc 无误；生产环境问题（排序/编号未刷新）根因是生产仍在跑旧镜像：需重新部署 + prisma migrate deploy + 执行 scripts/backfill-schedule-code.sql 回填存量编号（SQL 已本地验证）

---
## 2026-11-07 — 单位体系与供货关系设计方案（采购/库存重构前置）

### 背景
- 用户决策：彻底重构采购与库存，现有实现仅演示用，可直接替换
- 重构前置条件：先冻结食材（原料/调料）的采购单位与库存单位定义，这是易错地基

### 核心决策（方案 B：供货关系层）
- 三套单位体系显式分离：计算单位（g，排程/BOM）/ 库存单位（记账基准，唯一）/ 采购单位（属供应商供货关系，不属食材档案）
- 新增 `supplier_ingredients`：食材×供应商，含 purchase_unit / units_per_purchase（显式系数）/ purchase_price / is_default
- `ingredients` 移除 purchase_unit / purchase_spec / units_per_purchase / default_supplier_id，新增 grams_per_unit（每库存单位净含量克数）
- 单据快照换算系数，历史台账不受档案变更影响；散称=退化形态（采购单位=库存单位，N=1）
- spec-parser 文本解析逐步下线，系数不再运行时解析

### 产出
- 设计文档：memory-bank/Units.md（v1.0，待确认第六节三个事项：grams_per_unit 存量初始化、调料/酱料是否一次并入、计划多供应商拆单）
- 已登记 memory-bank/INDEX.md

---
## 2026-11-07 — 排程编号落库 + 工作台返回今日 + 交互规范化

### 排程编号（用户确认的定稿方案）
- Schedule 新增 code 列（唯一，可空；迁移 20261107140000，migrate deploy 应用 + 存量回填 SCH-日期-序号）
- 创建时生成 SCH-YYYYMMDD-NNN（当日序号，唯一冲突重试 5 次）；详情头部/打印单号/CSV 单号/快速查看全部读真实编号，废除 id 拼接
- 详情页菜品统计卡片去掉预估成本（并行会话已同步处理）

### 工作台
- 门店选择左侧新增「返回今日」（选中日期非今天时显示，重置日期与周偏移）
- 周日历条选中色由硬编码靛蓝 #EEF2FF/#6366F1 改 bg-primary/10 text-primary（主题色一致；DatePicker 弹层原本已是 primary）

### 悬浮交互规范化
- 详情页三表格行统一 transition-colors hover:bg-muted/40

### 环境备忘
- prisma migrate dev 在非交互 shell 不可用 → 用 migrate diff 生成 SQL + 手工迁移目录 + migrate deploy 替代
- 并行会话与本会话并发修改同一批文件（app/page.tsx、schedule-detail.ts 等），改动后务必以磁盘最新内容为准复核

### 检查
- tsc / build / lint（0 errors）/ jest 7/7 / 迁移零差异 全过；编号生成实测 SCH-20261108-001

---
---
## 2026-11-07 — 工作台计划数据直显 + 列表页卡片化/宫格筛选 + 字体本地化

### 工作台（app/page.tsx + /api/dashboard/daily）
- 排程创建后（未回录售出）即展示计划数据：菜品/规格/计划份数/售价/计划销售额，售出列显示"待回录"；头部 chips 增加计划销售额与预计毛利率（API 补 cost/planAmount）
- 回录后仍展示原复盘视图（售出进度/销售额/销售状态）

### 排程列表页
- 状态/门店筛选由 SelectField 换成 SelectTileMode（与菜品库"全部状态"同款宫格选择器）
- 列表由表格改回卡片式（用户偏好）：Card 组件 + 信息分区（标题/徽标 → 图标元信息行 → 负责人 → 操作区），hover 高亮，操作区 stopPropagation

### 字体本地化（重要环境修复）
- 根因：next/font/google（DM_Sans/Geist_Mono）在 dev 冷缓存时需联网下载，本机访问 fonts.gstatic.com 不通 → 全站 500
- 修复：layout.tsx 移除 next/font/google，改系统字体栈（PingFang SC/Microsoft YaHei；mono 用 ui-monospace）经内联 CSS 变量注入，--font-sans/--font-geist-mono 变量名不变，globals.css @theme 无需改动
- 教训：墙内/离线环境禁止依赖 Google Fonts；清 .next 前确认字体有本地兜底

### 检查
- tsc / build / lint（0 errors）全过；dev server 重启验证首页/列表/新建均 200

---
---
## 2026-11-07 — 排程列表页整体优化 + 新建页菜品筛选

### 列表页（按确认方案整体重构）
- 卡片式 → 标准表格：排程+状态徽标 / 生产日期(星期) / 门店 / 菜品·份数 / 负责人 / 操作(快速查看·详情)，整行可点进详情
- 筛选补状态（下拉：全部/待生效/进行中/已完成），与门店、日期范围同行；ListToolbar 重置按钮由 size=sm 改默认高度，整行控件统一
- 快速查看抽屉改为**复用详情页三个表格组件**（ScheduleMenuTable/CuttingTable/PurchaseTable），宽 max-w-4xl，数据、列、份数展示、打印/导出与详情页 1:1，杜绝不一致

### 新建排程页
- 菜品卡片去掉份数徽标（卡片是源数据，数量只在已选清单调节）
- 菜品只拉已发布：/api/dishes?status=published

### 踩坑记录（重要）
- Tailwind v4 自动扫描非忽略文件中的类名候选：memory-bank/UxAudit.md 文档里的 任意值类名写法（bg 绑定 status 通配变量） 示例被当成工具类生成非法 CSS，dev 编译 500。教训：**md 文档禁止出现任意值类名写法**（用 prose 描述）；已修正该文档措辞
- 并行会话的 UxAudit.md（UI 走查报告）提到 SelectField 默认触发器 h-8 与筛选行 h-11 不齐——本次通过 ListToolbar 按钮高度统一处理，若后续按 UxAudit 改 SelectField 默认高度需注意两处联动

### 检查
- tsc / build / lint（0 errors）/ jest 7/7 全过；dev server 已重启验证 200

---
---
## 2026-11-06 — 排程模块当日收尾：份数展示 + 采购取整规则定稿

### 切配份数展示（用户确认方案）
- 切配量一律按 g 展示；份数列显示「整份 + 零头」：1000g÷700g → "1 份 + 300 g"；不足 1 份 → "零配 800 g"；整份 → "2 份"
- formatPortions 位于 lib/shared/weight-format.ts（纯函数），底层保留精确值

### 建议采购量取整规则（三条，用户确认）
- 散称/按重直采（重量类采购单位）→ 按实际斤数 2 位小数
- 计件标品可换算（件/箱/桶/袋 + 规格含重量）→ 向上取整到整数采购单位
- 计件标品无法换算（如 1.9升*6瓶）→ 最小采购单位 1 件
- 预估金额同步修正：计件 = 采购单位数 × 每采购单位成本价（latestRefPrice 优先，回退 每单位斤数×每斤单价）；散称 = 需采购斤 × 每斤单价
- 重量单位集合来自单位字典 getWeightUnitNames（事务内读取）

### 其他
- 供应商模块文案「供应链」→「供应商」（设置首页入口 + 供应商页标题）
- 用户新增供应商「默认」后曾反馈"所有数据供应商被改"：经查数据库无变动（档案与采购计划 supplierId/Name 全空），疑似显示层误解，待用户复现定位

---
---
## 2026-11-06 — 切配/采购单据字段纠偏：全部回归基础数据字段

### 纠偏（用户验收指出，原实现违反「不造字段」原则）
- 编号废除 sourceType+id 拼接（NET-13/RAW-26），改读档案真实编码：CuttingOrder/PurchasePlan 新增 sourceCode 列（迁移 20261106124403），生成时取 NetIngredient.code / Ingredient.code / SauceIngredient.code
- 规格废除名称解析（parseCutSpec 已删除），改读净料档案 packageSpec（封装规格 g）
- 切配份数口径改为 = 切配量 ÷ 封装规格（原「菜品份数合计」作废）
- 切配量一律按 g 展示（废除 ≥1斤转斤的 formatWeight 展示），与「计量单位」列合并为单列「切配量」
- 经验：dev server 运行时 prisma generate/migrate 后必须重启（client 缓存）；构建前需停 dev server 并清理 .next/dev，否则 typedRoutes 生成文件并发写损坏

---
---
## 2026-11-06 — 采购计算量纲修复（出成率百分数 + 克→斤→采购单位换算）

### 问题（用户验收发现）
- 出成率公式错误：档案按百分数存（80/125/240），代码却是 净需求÷出成率，结果错 100 倍（螺丝椒 1250g→15.63「斤」，前腿巧合显示 16 斤实为 3.2 斤）
- 克数直接当采购单位数量：盐 100g→建议采购 100 件（1件=50斤）、生抽 150g→150 件、耗油 100g→100 桶
- 库存扣减与毛需求单位不一致（克 vs 入库单位）

### 修复
- buildPurchasePlans 重写计算段，统一量纲链：净需求(g) ×100÷出成率 = 毛料(g) → ÷每斤克数 = 毛料(斤) → 扣库存(斤，库存按入库单位×每入库单位斤数换算) → 建议采购量 = 需采购斤 ÷ 每采购单位斤数（向上取整；无法换算如液体按斤建议 2 位小数）→ 预估金额 = 需采购斤 × 每斤单价（落库，PurchasePlan 新增 estimatedAmount 列，迁移 20261106115939）
- 每采购单位斤数与档案每斤单价换算共用 lib/shared/spec-parser 同一套解析，口径一致
- unit-factors 四个函数改为可注入 PrismaClient/Tx（默认全局 prisma），事务内读单位字典
- stockDeducted 语义改为「实际抵扣库存（斤）」；展示层/CSV/打印同步改口径；schema 字段注释更新
- 测试扩至 6 项（散称按斤、箱换算向上取整、调料库存按包换算抵扣、液体回退按斤），全过；重算排程 1 验证：前腿 3.2 斤、螺丝椒 3.13 斤→1 箱、盐 0.2 斤→1 件（最小采购单位）

### 检查结果
- tsc / build / lint（0 errors，50 warnings 存量）/ 迁移零差异校验 全过；jest 6/6

---
---
## 2026-11-06 — 排程模块重构：三份核心数据定版 + 打印/导出 + 默认供应商

### 需求定版（与需求方确认）
- 排程状态降级：不再是列表筛选/详情展示维度，保留流转（待生效→已确认→已完成）作「单据锁定」；详情页状态退化为标题旁徽标，22:00 超时警告移除
- 三份数据字段定版（不合并、不创造，全部直接取基础数据字段）：
  - 排程菜单 10 列：序号、菜品名称、份量、荤素、菜品编号、数量（份）、成本/份、成本小计、售价/份、计划销售额（末列突出）；预计毛利率 =（计划销售额−成本合计）÷计划销售额×100%（真毛利率口径）
  - 切配工单 8 列：一级/二级分类、编号、名称（净菜档案名）、规格、切配量、计量单位、切配份数（末列突出）；切配份数 = 排程菜单中使用该净菜的菜品份数合计（计算字段不落库）
  - 采购计划 11 列：一级/二级分类、编号、食材名称、采购规格、毛料需求（斤，g÷500）、库存扣减（斤）、建议采购量、采购单位、供应商、预估金额；实际采购量/实际切配量从 PC 单据移除（移动端回录阶段再显示）
- 采购统一入净菜加工中心，采购单据不体现门店；打印采购单两种方式：全部打印 / 按供应商拆单打印
- 供应商跟原料档案关联（新增「默认供应商」字段）

### 本次交付
- 表结构迁移 20261106082756：Ingredient / SauceIngredient 新增 defaultSupplierId（可空，关联 Supplier）；PurchasePlan 新增 supplierId + supplierName（生成时回填，冗余名称防改名断链）
- lib/server/schedule-utils.ts：buildCuttingOrders 填充 spec（净料取 BOM 明细 DishNetDetail.spec，小料取净料档案 spec）；buildPurchasePlans 回填默认供应商
- lib/server/schedule-detail.ts（新增）：详情数据组装（API 与打印页共用），含切配份数计算、采购一级分类、预估金额（建议采购量÷500×每斤单价）
- 打印路由 /schedules/[id]/print?doc=cutting|purchase&mode=all|supplier：A4 单据含单头（收货单位=净菜加工中心）、分类分组明细、合计、签字栏；按供应商模式每供应商一张独立单据
- 详情页重构：三段数据改 Tab（菜单/切配/采购），顶部卡片保留（状态卡改为制单信息卡），右上角操作区不变
- 三个表格组件重写（menu/cutting/purchase）：新字段列 + CSV 导出带 BOM 与单头信息行
- 食材档案（原料/调料/酱料）表单 + API 新增「默认供应商」（复用 SupplierSelect 组件）
- 单元测试：lib/server/__tests__/schedule-utils.test.ts 4 项（聚合/规格填充/出成率折算/供应商回填/库存扣减）

### 检查结果
- npx tsc --noEmit / npm run build / npm run lint（0 errors，50 warnings 存量）/ 迁移零差异校验（empty migration）全部通过；jest 4/4 通过

### 待办（下一迭代）
- 排程列表页（已完成）：去状态 Tab（状态降级为行内徽标），筛选保留搜索/门店/日期；新增「快速查看」抽屉——三份核心数据 Tab 切换（菜单/切配/采购精简列），抽屉内可直接打印切配单、打印采购单（全部/按供应商），或跳转完整详情
- 新建排程页（已完成）：菜品卡片与已选清单展示份量（单人份=天蓝/一锅10份=橙）、荤素（荤=红/素=绿）、售价（黄底）徽标；/api/dishes 已返回字段，纯前端
- 移动端：切配工/采购员角色终端回录 actualQty / actualPurchase

---

## 2026-11-06 — 会话有效期收紧：7 天 → 30 分钟

- 背景：用户反馈输入服务器 IP 可直接进入系统，要求做基本登录验证限制。排查结论：系统已有完整 JWT 登录体系（middleware 全路由拦截，本地生产构建实测未登录访问页面 302→/login、API 401），疑似原因是 session cookie 有效期 7 天过长（浏览器留存登录态）或线上镜像过旧
- 本次修改（仅改有效期，其它保持不变）：
  - `lib/server/session.ts`：JWT `setExpirationTime("7d")` → `"30m"`；cookie `maxAge` 7 天 → 1800 秒
  - `lib/server/__tests__/session.test.ts`：maxAge 断言同步更新（10 项测试全过）
- 排查过程中的环境备注：`lib/server/` 目录沙箱内直接写入会被拒（需提升权限执行）；Next.js 16 已弃用 `middleware` 约定（改名 Proxy），后续建议迁移 `middleware.ts` → `proxy.ts`
- 检查结果：`npx tsc --noEmit` / `npm run build` / `npm run lint`（0 errors，49 存量 warnings）全部通过

---
## 2026-11-07 — BUG 修复：菜品库小料/调料规格口径不一致 + 重点事项记录

### BUG 修复（规格字段口径统一）

- **根因**：菜品 BOM 回显/展示的规格来源与食材模块不一致——
  - 小料：dishToBom 未给 spec 赋值，详情页甚至拿 brand（商品名）当规格展示；食材模块口径应为**封装规格 packageSpec**（如 500g）
  - 调料：详情 API 增强缺采购规格字段，BOM 行把 brand 当"商品名称"展示；食材模块口径应为**采购规格 purchaseSpec**（如 1.9L*6）
  - 主料/辅料同类隐患：展示用的是已废弃的自由文本 spec 字段
- **修复**：
  - API：GET /api/dishes/[id] 调料增强补 purchaseSpec → 映射为明细 spec
  - 共享辅助 netSpecText()（types.ts）：净料系规格 = packageSpec 优先、历史值兜底
  - dishToBom：主料/辅料/小料 spec 统一走 netSpecText；调料 spec = purchaseSpec
  - 详情抽屉规格列：小料显示封装规格（不再显示 brand）、调料显示采购规格，仅酱料保留"商品名称"列
  - BOM 编辑器行：调料由"商品名称"改为"规格"展示（仅酱料保留商品名称）

### ⚠️ 重点事项（待专项处理）

- **采购单位与入库单位在采购数据计算中未发挥作用**：当前采购入库/金额计算疑似只按单一单位口径走，计价单位↔计量单位的换算逻辑（依据采购规格）未生效。需专项排查采购计划、采购入库单、库存台账整条链路的单位换算，涉及金额与库存数量的准确性。
- 建议立项：梳理「采购单位/计价单位/计量单位」三单位体系在采购、入库、库存、BOM 成本各环节的实际生效情况。

---

## 2026-11-06 — 菜品发布校验放宽：调料不再必填

- 移除 validatePublish / validateDishDetailForPublish 中「调料不能为空」校验；现发布仅要求主料+辅料
- 背景：让业务先跑起来，后续数据齐备后再收紧

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

---

## 2026-11-09 — 食材库首页改版：抽象转化流程图

### 背景

用户希望在食材库首页用流程图直观表达五类食材间的数据转化关系，替代卡片平铺。经过 4 轮原型迭代（prototypes/ingredient-flow.html）逐轮收敛，用户最终确认的设计原则：**直观简单准确第一，可有可无/模糊不清的一律不体现**。

### 最终设计（已落地为正式版 /ingredients 首页）

- 三层列标题：食材入库 / 初加工 / 复合加工（纯文字，无序号无箭头——用户明确三阶段非渐进逻辑）
- 5 个类型节点：彩色字标 + 名称 + 实时数量 + 一句事实描述；无任何公式碎片文案
- 4 条转化流（颜色跟随来源节点）：原料→净料、原料→小料（橙色流）；小料→酱料（红）、调料→酱料（蓝）——两路汇入酱料即"配比组合"的视觉表达
- 箭头带大号三角头部 + SMIL 流动粒子（正式版修复了原型 v4 丢失 marker-end 的 bug）
- 酱料卡片内嵌 自制（调料+小料配比）/外购（直接采购）分栏，解释外购无上游
- 底部统一计价胶囊条：成本价→出库价→标准规格价（纯术语，无公式）
- 悬停高亮完整转化路径，点击进入对应清单页；右上角汇总数字已去掉（用户判定无意义）

### 技术要点

- app/ingredients/page.tsx 整页重写（React + Tailwind，client component）
- 数量接 /api/ingredients/summary；window focus/pageshow 自动刷新保留
- SVG 连线：useEffect 取 DOM 坐标算 cubic bezier，resize 重算；defs marker 按流索引定义
- 无 schema 变更，按新版 AGENTS.md 开发阶段规范仅执行 tsc（通过）+ 浏览器热更新验证

### 复盘（两轮用户批评的沉淀）

1. "对转化逻辑理解不透彻"：酱料 = 调料 + 小料配比组合（首轮误画净料→酱料）
2. "受补充信息影响大，轻视模块迭代思路"：新增可视化时先回模块既有语义找准确性，不为炫技加信息
3. 视觉迭代方法论：先逻辑后视觉；用户的"丑"通常 = 信息层级不清 + 装饰性元素抢戏，解法是砍信息、强色彩层级，不是加装饰
---
## 2026-11-10 — 库存模块重构：净菜库存管理 v001（设计 + 原型）

### 需求决策（张浩浩）
- 完整放弃现有库存管理功能（原料精确库存、采购入库联动、切配扣原料库存全部下线）
- 库存对象 = 净菜（食材库净料 + 小料），只有两条动线：完成生产→入库；出库单→出库
- 交付物：
  - memory-bank/净菜库存管理-讨论.md（阶段一，含 8 条关键口径假设待确认）
  - memory-bank/v001-净菜库存管理-方案.md（PRD：数据模型/状态机/API/页面/联动调整）
  - prototypes/v001-净菜库存管理.html（可交互原型，Playwright 全链路验证通过）

### 核心设计点
- cutting_orders 加 completed_qty/completed_at/remark；完成生产弹窗三态：完成（实际量入库，默认=需求量可改小）/未完成（当日终态+备注）/暂不确认（保持 pending，实现分批提交）
- 排程完成条件：全部工单达终态自动「已完成」；有 pending 则保持进行中可再次提交
- 新表：prepped_stock（净菜汇总库存，单位 g）、prepped_stock_ledger（台账）、outbound_orders + items（出库单，明细快照分类/名称/份数/用量/可出量）
- 出库单行状态：未切配（红，可出 0）/量不足（橙）/正常（绿）；可出量=min(需求,实际库存)；创建即扣库存，作废回滚（作废≠删除）
- 待确认：口径表 8 条（部分完成/分批/按可出量出库等）、配送字段、采购计划不再扣库存、旧数据归档

### 环境备忘
- node_repl 内 playwright-core 需 createRequire 加载 + executablePath 指向本机 Chrome（无 headless shell）
---
## 2026-11-10（晚）— 净菜库存管理 v002：入库线移至生产计划单 + 按份出入库

### 张浩浩新决策（第二轮）
- 入库线移到排程模块新增的「生产计划单」（ProductionPlan，跨店汇总进行中排程 cuttingJson 快照）；排程详情完成入口下线
- 库存单位拍板：**按份出入库**（封装规格 g/份 换算，packageSpec 净料/小料必填，双单位：库存份数 + 库存量g）
- 当前库存页去掉 KPI 汇总，只留 库存份数 + 库存量(g) 两个字段
- 出库单列表 11 列定稿：序号/出库单号/门店/来源排程单名称/出库份数/合计金额/是否按计划出库/状态/库管负责人/创建时间/操作
- 合计金额 = 出库价（净菜档案元/斤链路快照）× 出库g ÷ 500；是否按计划出库 = 逐行 shipped==required
- 暂缓开发，待排程模块完成后再进入；交互视觉必须匹配现行系统规范

### 产出
- memory-bank/净菜库存管理-讨论.md 追加第二轮补充
- memory-bank/v002-净菜库存管理-方案.md（替代 v001）
- prototypes/v002-净菜库存管理.html（Playwright 全链路验证：按份完成生产→双单位入库→按份出库+金额→未按计划标记→作废回滚→台账）

### 关键设计
- 完成确认单位 = 计划单跨店合并行；三态（完成/未完成/暂不确认）按份录入实际完成份数
- prepped_stock 双单位（current_portions 主 + current_qty 辅）；台账双单位
- 计划单完成后回写各店 cutting_orders（actualQty 按需求占比分摊，展示级）
- v002 原型修复记录：submitComplete 未完成分支引用了完成分支的局部变量 k；种子数据份/g 对齐
---
## 2026-11-10（深夜）— 净菜库存 v002 开发完成并端到端验证

### 交付（按 v002 PRD 落地）
- Schema + 迁移 20261110160000_add_prepped_stock_outbound：prepped_stock（份+g 双单位）/ prepped_stock_ledger / outbound_orders / outbound_order_items；旧 inventory 表保留停用
- 服务端：lib/shared/prepped-stock.ts（类型+纯函数）、lib/server/prepped-stock.ts（applyStockChange 双单位变动+台账，出库条件更新防超发）、lib/server/outbound-utils.ts（getOutboundLines 计划行+库存+出库价快照）、lib/server/schemas/prepped-stock.ts（zod）
- API：
  - PUT /api/production-plans/[id]/complete 改造：行级三态确认（完成/未完成/暂不确认，幂等跳过终态行）→ 快照演进 → 入库 → 回写各店 cutting_orders（actualQty 按需求占比分摊）→ 计划单终态
  - GET /api/prepped-stock、GET /api/prepped-stock/ledger（分页+筛选）
  - GET/POST /api/outbound-orders（POST 事务：快照+扣库存+台账+as_planned；GET 兼报价预览 ?scheduleId=）
  - GET /api/outbound-orders/[id]、POST /api/outbound-orders/[id]/void（作废回滚事务）
- UI：/inventory 三 Tab（当前库存无 KPI 份+g / 出库单 11 列 / 双单位台账）、/inventory/outbound/new 两步向导（按份编辑+行金额实时）、/inventory/outbound/[id] 详情（作废 Dialog+打印）、打印页、生产计划单详情接入完成生产弹窗+切配确认进度卡片
- 下线：/api/inventory*、/api/schedules/[id]/complete、排程详情完成按钮、采购入库库存联动、采购计划库存抵扣（stockDeducted 恒 0，建议=毛需求）、死组件 ingredient-card/inventory-status

### 验证
- tsc 0 / eslint 0 errors（warnings 与存量一致）/ build 通过 / 迁移零差异通过 / jest 94-95（唯一失败 middleware 用例为存量问题，与本次无关）
- Playwright 端到端（admin 会话，真实数据）：激活 PPL-20261110-002 → 完成生产（前瘦改 1 份部分完成）→ 库存 4 种入库 → 台账 4 笔入库 → 创建出库单 OUT-20261110-001（5 份/¥27.09/前瘦量不足/未按计划）→ 作废回滚 → 库存恢复、台账 12 笔全轨迹

### 环境备忘
- 本会话沙箱对 lib/server、app 目录写入需 require_escalated（其余目录正常）；prisma generate/build 需提权
- 新 prisma CLI：migrate diff 用 --from-schema/--to-schema + -o（--script 不支持 --output 混用旧参数）；schema.prisma 写入必须无 BOM
- 造合法会话：node --env-file=.env --import tsx 调 createSession（lib/server/prisma 会触发 env-check，必须带 .env）
- 排程模块并行会话正在改 app/schedules/*（当时 tsc 报的 schedules 语法错误均为其中间态，非本次引入）
---
## 2026-11-10（部署）— v002 净菜库存 + 生产计划单 已上线生产

- 提交 01e4431（70 文件，main）已推送 GitHub 并部署至生产 101.37.64.216
- 部署由并行会话触发（服务器 git pull --ff-only + docker compose up -d --build），本会话完成验证
- 验证结果：
  - 服务器代码 HEAD = 01e4431 ✓
  - migrate 容器 Exited(0)，生产库新表全部就位：production_plans / production_plan_schedules / prepped_stock / prepped_stock_ledger / outbound_orders / outbound_order_items ✓
  - web 容器 Up，http://101.37.64.216/login → 200 ✓
  - web 近 10 分钟日志无 error/unhandled/failed ✓
- 部署方式备忘：deploy.sh 为 bash 脚本（Git Bash 不在本机标准路径），本机用 Windows OpenSSH 等价执行：ssh -i ~/.ssh/aliyun_deploy root@101.37.64.216；migrate 由 docker-compose migrate 服务自动执行，无需手工 migrate deploy
- 生产数据待办：存量净料/小料需补齐 packageSpec（封装规格），否则完成生产/出库对该净菜报错拦截
