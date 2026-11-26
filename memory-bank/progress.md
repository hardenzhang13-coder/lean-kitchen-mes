# 精益厨房 V3 — 项目推进日志

> 按日期记录核心推进过程，包括技术决策、问题解决、功能交付。


## 2026-11-26 — 原料库优化：出成率前置 + 通用组件修复 + 使用概况

浩哥对原料库提三项优化，本轮全部落地：

### 1. 出成率前置到建档
- **Schema**：`ingredients` 新增 `yield_rate`（可空 DECIMAL(5,2)，空 = 未设置），迁移 `20261126022318_ingredient_yield_rate` 仅一条 ADD COLUMN，无回填无重写。
- **表单**：食材/调味品新建与编辑均加「出成率（%）」，放在「价格与出成率」组（原「价格与供应商」改名）；**默认供应商字段从该组挪到「基础信息」**（浩哥要求）。调味品与食材同一套字段，出成率 hint 按 mode 分别说明转化对象。
- **列表**：食材清单与调味品清单在「每斤单价」后加「出成率」列，空值显示「未设置，转化净料时手动填写」提示。
- **转化预填**：净料转化预填来源原料出成率（有则用，无则留空让用户填，不再默认 100）；调料转化预填来源调味品出成率，仍兜底 100。

### 2. 通用组件修复
- **下拉宽度**：`SelectField` 触发器基础类 `w-fit` 改为 `w-full`（tailwind-merge 覆盖 shadcn 基础类），全系统表单下拉统一满宽；筛选栏等按内容收缩的调用点本就显式传宽度，未受影响。「调料分类宽度不一致」由此根治。
- **空态保留表头**：`DataTable` 空数据时改为「渲染表头 + 表体内 colSpan 单元格嵌 EmptyState」，与 loading 态同构；全系统列表统一受益。`net-ingredient-form-dialog` 里手搓的小料规格表同步改为表头 + 行内空态。
- **抽屉两列宽度**：抽屉表单按列宽适配字段展示宽度（随通用件改动一并回归目视）。

### 3. 使用概况（三类调料清单新增）
- **命名统一为「使用概况」**：浩哥定名（原「关联菜品」）。
- **范围**：仅单品调料 / 复合调料 / 成品酱料三类产物清单新增入口；**原料不做**（浩哥明确砍掉）；净料/小料存量详情抽屉入口改名换皮，沿用既有接口。
- **API**：新增 `GET /api/seasoning-products/[id]/dishes`，按 `dishSeasoningDetails.some({ specId })` 反查菜品，分页返回 `{id, code, name, portion}`；含路由测试（3 例：分页反查 / 产物已删 404 / 非法 id 404）。
- **弹窗**：新增通用件 `MaterialUsageDialog`，严格用 `FormDialog` + `AppDialogContent size="wide"` + `DialogHeader` + `DataTable` 组装（浩哥要求匹配通用组件样式），替代原先裸 `Dialog` 的 `net-ingredient-dishes-dialog`（该文件已删除）。空态「暂未用于任何菜品」走表头 + 行内空态。

### 4. 顺带修掉的 Zod 4 隐患（根因级）
- 现象：浏览器实测 `PUT /api/ingredients/30`（调味品「盐」）只传 `{yieldRate: 80}` 报 400「食材必须选择二级分类」。
- 根因：**Zod 4.4.3 的 `.partial()` 会保留 `.default()`**——`updateIngredientSchema` 由 create 派生，部分更新缺省的 `kind` 被静默填成 `"food"`，调味品被当成食材。同类隐患还有 `unit.ts` 的 `isActive`（漏传会把停用单位强制激活）。
- 修复：默认值只放 create 侧，update 侧显式 `optional()`；`ingredient.ts` 与 `unit.ts` 同批修。
- **回归防护**：新增 `lib/server/__tests__/ingredient-schema.test.ts`（5 例）锁定「update 不得继承 create 默认值」。连带修正 `app/api/ingredients/[id]/__tests__/route.test.ts` 的 mock（补 `kind: "food"`，此前靠默认值巧合通过）。

### 文档与样张
- `docs/interaction-visual-baseline-v1.md`：空态条目补「表格空数据保留表头，空态收进表体单元格」；「关联菜品」条目改写为「使用概况」并覆盖三类调料清单与 `MaterialUsageDialog` 组装口径；新增出成率字段与预填约定。
- `/ui-kit` 新增「空态表格」样张。

### 验证
- `npx tsc --noEmit` 0 错误；`npx eslint app lib` 0 error / 0 warning；`npx jest` 80 套件 / 423 用例全绿（含新增：schema 默认值回归 5 例、路由调味品出成率 1 例、DataTable 空态 3 例、使用概况弹窗 3 例、净料/调料转化预填 2 例）；`npx next build` 成功；`migrate diff` 输出空迁移。
- 端到端复核（直调 PUT 路由 + 本地真实库）：调味品「盐」只传 `{yieldRate: 80}` 返回 200，kind 仍为 seasoning、出成率落库（验证后已回写原值）。
- 待补：浏览器目视回归（新增/编辑表单分组与出成率列、调料清单「使用概况」弹窗、空态表头、下拉宽度）——本轮浏览器通道被工具限流未能执行。

---

## 2026-11-26 — 生产分类对齐回填 + seed 份量重建根因修复

### 1. 净料/小料分类历史漂移回填（生产库，51 行）
- 根因：食材改分类**同事务级联净料/小料**是 11-25（`7a5e466`）才上线的，之前改分类不同步，历史漂移残留。
- 口径：**净料分类 = 来源食材分类的弱引用副本**（需对齐）；**小料分类在 MIN 子树是自己的业务归属**（与来源不同属设计如此，不动）。
- 执行：生产库 13 组显式 UPDATE（id 清单 + 旧值保护 + 未删除条件），51 行净料对齐来源食材分类；复查漂移 0、26 行小料未动。
- 遗留代码缺陷（未修）：级联 `updateMany` 未排除小料，改来源食材分类会把小料的 MIN 分类冲掉，后续应在级联条件里排除 MIN 子树。

### 2. 停用分类仍被引用导致清单显示编号（生产库，10 行）
- 现象：部分食材无一级分类、二级分类显示编号。根因：「鸡肉类 POU-CHI」被停用但仍挂 3 食材 + 7 净料；业务分类树只返回启用分类，前端查不到名称回退显示编号。
- 处置（浩哥定）：3 食材 + 7 净料改挂「禽肉类 MT-PL」，复查 POU-CHI 引用清零。

### 3. seed 每次发版重建份量旧行（根因修复）
- 根因：份量种子按 `portion` 标签「缺失才创建」；生产把「社区·2份→社区1份」「小碗菜·10份→单人份*10」改名后，旧标签每次部署被重建（菜品库同时冒出空的分组 Tab）。
- 修复（`prisma/seed.ts`）：份量改**空表才初始化**，初始值同步生产现名（单人份 / 社区1份·社区家庭×2 / 单人份*10·食堂团餐×10）；同时删除已被生产淘汰的 PIG 猪肉类 + PIG-COL 冷鲜分类种子（同机制会被重建）。

---

## 2026-11-25（复核收敛）— 调味品升级按浩哥复核意见返工

调味品模块升级提交后浩哥复核提出三点返工，本轮全部落地：

### 1. 类型回归调味品档案
- `ingredients.seasoning_type` 恢复（迁移 `20261125173000_seasoning_type_on_ingredient`），新增/编辑调味品时选择单品调料 / 复合调料 / 成品酱料；改类型同事务级联未删除产物的 `productType`（快照口径）。
- 三个产物 Tab **取消新增入口**：产物只能由调味品行「转化」生成，产物类型继承来源调味品（POST 派生 + 未设类型拒绝转化，提示先回档案补类型）。

### 2. 纯转化口径（外购建档整体移除）
- 产物表单去掉「产物类型 / 来源方式 / 来源调味品」三个字段；`source_mode` 及外购字段组（brand / purchaseSpec / purchaseUnit / latestRefPrice / pricePerJin / default_supplier_id）整列删除；存量 purchase 行随迁移清除。
- 价格链收敛单口径：单价 = 来源调味品每斤单价 ÷ 出成率；`deriveSeasoningProductPrices` 输入不再分 transform/purchase。
- 采购计划去掉 `sourceType:"seasoning_product"` 独立行分支，产物一律按出成率折算并入来源调味品行。

### 3. 产物去份量、指标对齐食材模块
- `portion` 列删除；产物表单三段对齐净料表单：规格指标（包装规格，默认 500g）/ 加工指标（出成率、产物单价只读、封装加工费、毛利率）/ 价格指标（成本价、出库价、标准规格价，均只读派生）。

### 验证
- 全量门禁绿：tsc 0 错误、`npm run verify`（ESLint + 全量 Jest）通过、`migrate diff` 零差异。
- 本地库 checksum 漂移已修复（两处中间版迁移 20261124130000 / 20261125110000 全量对齐 checksum 后 `migrate dev` 应用 20261125173000，库与 schema 同步）。
- 浏览器实测通过：调味品 Tab 类型列 + 转化入口；转化弹窗标题「转化为{类型}」、无产物类型/来源方式/来源调味品/份量字段、默认 500g/出成率 100、产物单价按来源实时派生；转化提交 201（productType 继承、无 portion/sourceMode）；产物 Tab 无新增按钮、无份量列；未设类型的调味品点转化被拦截并 toast；新增调味品表单含类型字段。

### 同日复核第二轮：文案与列表口径
- **「产物」文案全模块改「调料」**：转化弹窗（调料名称/调料单价/查看已有调料）、调料 Tab 列表、查看调料抽屉、食材库总览（删掉遗留的「调料产物 · 外购」计价行）、菜品 BOM 选择器（调料名称/来源调味品）。
- **调味品列表**：「类型」列改名「调料分类」，移到商品名称后；表单/详情抽屉同步改名。
- **调料列表列结构对照净料清单**：序号/编号/调料名称（去类型标签）/来源调味品（直读名称，去「转化 ·」前缀）/包装规格/出成率/调料单价/毛利率/标准规格价（主色强调）；出库价移出列表。
- 服务端校验文案同步：「未设置调料分类，请先在调味品档案中选择调料分类」。

---

## 2026-11-25（续）— 调味品模块整体升级

浩哥定调：**调味品像食材一样属于原材料，原材料转化后形成三种系统化、标准化的调料产物**（单品调料 / 复合调料 / 成品酱料——三者同构，只是叫法，无配方）。

### 1. Schema（单迁移 `20261125110000_seasoning_module_upgrade`，一次切干净）
- `ingredients` 新增 `kind`（food=食材 / seasoning=调味品）作为**边界唯一真源**，替代 SEA 分类判定；调味品行 `l2_code` 置空、列改可空；删除 `seasoning_type`（前一天刚加的字段，仅存续一天）；SEA 分类树（SEA / SEA-SOL / SEA-LIQ）带引用保护删除。
- `StandardSeasoning` → **`SeasoningProduct`**（物理表 `standard_seasonings` 不动，存量 `spec_id` 外键零触碰）：新增 `productType` / `sourceMode`（transform / purchase）+ 外购字段组（brand / purchaseSpec / purchaseUnit / latestRefPrice / pricePerJin / defaultSupplierId）；`sourceIngredientId` / `yieldRate` 改可空；`l2_code` 整列删除。存量回填 transform + 单品调料。
- 酱料配方机制（SauceIngredient 自制 + SauceRecipeDetail）**业务剥离**：写 API 冻结、页面下线，模型与历史数据只读保留（先例 SelfProductionOrder）。

### 2. 服务端与 API
- 价格链唯一真源 `lib/shared/seasoning-spec.ts` 的 `deriveSeasoningProductPrices()`：转化单价 = 来源每斤单价 ÷ 出成率；外购单价 = 手填每斤单价；成本价 → 出库价 → 标准规格价与净料同构。
- `/api/standard-seasonings` 改名 `/api/seasoning-products` 并扩展（productType / sourceMode 过滤、双口径建档、编号 SP-xxxx）；全库 `getSeasoningL2Codes` 约 18 处替换为 kind 判定；AI 识别 matchType、采购 import 前缀、ingredient-summary 计数同步切换。
- **菜品 BOM 双口径**：`specId` 行 = 产物（按克计价，行成本 = 产物出库价 × g ÷ 500，`sourceId` 写 0 哨兵）；存量 `sourceId` 行只读保留（每斤单价 × g ÷ 500）。`sauceDetails` 保留 zod 可选透传，保存不再清历史酱料行。
- **采购计划**（`buildPurchasePlans`）：transform 产物按出成率折算并入来源调味品行（`sourceType:"seasoning"`）；purchase 产物生成独立行（`sourceType:"seasoning_product"`）。

### 3. UI
- 调味品页四 Tab 换源：「调味品」= 原料层（`/api/ingredients?kind=seasoning`）；单品/复合/成品 = 产物层（`/api/seasoning-products?productType=`）。
- 产物表单弹窗支持转化 / 外购双口径；默认值：包装规格 500g、份量取档案 multiplier=10 行（份量档案异步返回后经 resetKey 重建表单生效）。
- 菜品 BOM 调料选择器数据源改产物（三类型混合 + 类型标签列，无分类级联），按克输入保留（默认 10g）；酱料选择入口下线，存量酱料行只读渲染；`/ingredients/sauce` 页面删除。

### 4. 验证
- 全量 Jest 76 套件 / 410 用例全绿；tsc 0 错误；`npm run build` 通过；`migrate diff` 零差异。
- 浏览器实测：四 Tab 列/筛选、转化弹窗默认值、菜品 BOM 选产物按克计价（¥0.09 = 4.61×10÷500）、SEA 从分类接口消失、/ui-kit 样张三档宽度无横向溢出、console 零报错。
- 已知边界：存量酱料行只读经单测覆盖（dev 库无菜品引用酱料，浏览器无法实测）；存量产物编号 SEA-SP-xxxx 为历史编号保留，新建产物用 SP- 前缀。

---
---

## 2026-11-25 — 试运行修复：分类级联、转化源锁定与食材清单交互

### 1. 食材分类修改级联净料/小料
- 根因：`ingredients.l2_code` 与 `net_ingredients.l2_code` 是转化时写入的弱引用副本；食材 PUT 只改自身，净料/小料分组就停在旧分类。
- 修复：食材更新先校验二级分类存在；`l2_code` 变化时在 `$transaction` 内按 `source_ingredient_id` 级联更新未删除的净料/小料，操作日志记录级联数量。新增 API 事务测试。
- 边界保护：来源分类跨入/跨出 MIN 时，若派生净料/小料仍被菜品 BOM 引用，事务内拒绝更新，避免 BOM 业务归属漂移。

### 2. 菜品转化只允许单人份作源
- 份量倍率唯一方向是「单人份 → 场景规格」；场景规格互相转化会破坏倍率口径。
- 修复：预览与执行都调用 `validatePortionSourceForScale()`，只放行启用中的 `is_base` 档案；列表和详情用 `isBasePortion()` 隐藏非单人份转化入口。

### 3. 食材清单交互与文案收敛
- 首个页签改名「食材清单」；食材行操作收敛为「编辑（默认动作按钮）→ 转化（primary 最右）」，移除操作列查看；点击整行仍进详情。
- 食材列表隐藏入库单位；模块内食材相关文案从「原料」改为「食材」（新增、复制、导入、详情、来源食材等）。
- 同步更新交互基线 §6.2.4 与 Router 食材清单操作口径。
- 首页卡片在现有 iOS 流向卡内融合明细数据：食材展示采购食材/净料/小料，调味品展示基础原料与三类产物；香料保留东方/西方占位格式，菜品库只显示单人份数。去除分割线与派生提示；设置分组标题移除无意义项数。

---
---

## 2026-11-24（再续）— 紧急修复两则：出库时间限制解除 + 份量档案改名级联

### 出库时间不再限制（96866ec）
- 用户要求出库时间不做限制：服务端 zod 删「不能晚于当前时间」校验，前端新建出库单删对应报错与 datetime-local `max`；测试反向断言未来时间可通过。已部署生产。

### 份量档案改名数据「消失」事故（54fc5c9 + 生产回填）
- **现象**：生产上把份量档案「小碗菜·10份」改名为「单人份·10份」后，菜品库团餐食堂分组数据全部「消失」。
- **根因**：`dishes` / `net_ingredients` / `standard_seasonings` 的 `portion` 存的是**份量标签字符串**（弱引用），档案 PUT 改名只更新档案行；菜品库份量分组 Tab 按场景标签 IN 过滤（`GET /api/dishes?portionGroup=`），新标签匹配不上旧数据 → 过滤为空。数据未丢。
- **修复**：① 代码——`PUT /api/portion-profiles/[id]` 改名时在 `$transaction` 内级联回写三张业务表；② 数据——生产回填 106 行（dishes 14 / net_ingredients 89 / standard_seasonings 3）`小碗菜·10份 → 单人份·10份`，回填后分组恢复。
- **遗留**：`社区·1份` 在 dishes 2 行、net_ingredients 6 行上仍存在但档案行已删（孤儿，进不了社区分组），待用户决定恢复档案行或并档。

---

## 2026-11-24（续）— 食材库首页三节点流向菜品库 + 调味品类型字段独立

### 背景与决策
- 用户查看原料库首页后拍板方向修正：首页撤下净料/小料节点，新增**香料**占位节点（与食材、调味品同级），三个节点统一流向**菜品库**；净料/小料清单页保留不动。
- 单品调料/复合调料/成品酱料**不进食材分类体系**：撤掉当天上午 `20261124130000` 刚引入的 SEA-ITM/SEA-COM/SEA-SAU 三个二级分类，改为 `ingredients.seasoning_type` 独立字段（可空，空 = 基础调味品），表单中放在商品名称下方。
- 附带修复：`.tmp-stage`（仓库整份暂存副本）导致 Jest 重复收集旧测试，已加入 jest 忽略与 gitignore。

### 交付
- **数据**：`ingredients.seasoning_type VARCHAR(20)` 新增列（迁移 `20261124170000`，带引用保护回退三个分类行，前置盘点 0 引用）；`seed.ts` 删三行分类；五件套枚举 `lib/shared/seasoning-type.ts` + 渲染组件 `SeasoningTypeTag`。
- **服务端**：ingredients zod/GET/POST/PUT 全链路（POST 拒非 SEA 分类携带类型；PUT 空串清空）。
- **前端**：首页三节点 + 菜品库终点（香料占位卡不可点击）；调味品表单类型下拉（SelectField，哨兵值承载「不设置」）；四 Tab 改按类型过滤；列表名称列类型标签；详情抽屉展示类型。
- 附带：`jest.config.ts` 忽略 `/.tmp-stage/`，`.gitignore` 同步。

### 验证
- `npm run verify` 全绿（tsc + ESLint + 410 Jest，新增 seasoning-type 五件套 3 用例）；Prisma 零差异校验通过。
- 运行时 curl：POST 带类型创建落库、非 SEA 分类携带类型 400、GET `seasoningType` 过滤正确、PUT 空串清空为 null（测试档案已删）。
- 浏览器目视：首页三节点 + 流向菜品库连线 + 香料占位徽标；新建弹窗类型字段位于商品名称下方；Tab 切换过滤生效（类型页签当前空态、调味品页签 5 条）。

---

## 2026-11-24 — 份量数据迭代收尾：菜品库分组档案化 + 食材库规范 + 调味品模块升级

### 背景与决策
- 菜品库表头单人份/社区/团餐食堂三档为硬编码（GROUP_TABS / API where / portion-scale 常量三份互不同步），且 community 用 notIn 开集兜底、single 含已迁完的「小碗菜」，语义漂移——改为份量档案 `scenario` 驱动。
- 食材库命名规范：入口页与清单页标题「食材库」（侧边栏维持「原料」）；拍板规范：凡有核心主操作的列表页，主操作固定操作列最右。
- 调料更名「调味品」：与食材同属一种实体属性；SEA 下新增单品调料/复合调料/成品酱料三个二级分类；复活 `standard_seasonings` 为「调料清单」（完整复刻食材→净料转化链路）；现有酱料模块只隐入口（模型/API/菜品 BOM 保留）。

### 交付
- **261a4c5 feat(seasoning)**：SEA 三分类 seed（仅缺失时创建）+ 幂等迁移 `20261124130000`；调味品页四 Tab 重构（SeasoningListPanel）；`STANDARD_SEASONING_ENABLED` 置 true；全量文案更名 调料→调味品；看板酱料节点隐藏。
- **1c64cec feat(dishes)**：分组 Tab 由 `usePortionProfiles` 按 scenario 动态生成（加载失败回退三组兜底值）；`GET /api/dishes?portionGroup=` 改自由字符串、按场景启用档案行 IN 过滤；清理 portion-scale.ts DISH_PORTION_GROUPS 系列作废常量。
- **41e3054 feat(ingredients)**：清单页标题「食材库」、首 Tab「食材」；原料列表操作列 查看 → 编辑 → 转化；交互基线 §6.2 操作顺序条款更新。

### 验证
- `npm run verify` 全绿（tsc + ESLint + 407 Jest）；Prisma 零差异校验通过。
- 运行时 curl 验证：`portionGroup=单人份/社区/团餐食堂/不存在场景` 返回 2/1/1/0；`l2Code=SEA-COM` 过滤正确；`POST /api/standard-seasonings` 创建成功且价格链派生正确（测试档案已删）。

---

## 2026-11-24（续）— 出库来源修正：按生产批次（PPL）拆店出库

### 需求校准
- 「没有排程单也能出库」不等于任意手工挑库存；生产批次 = 切配计划单编号（PPL）。
- 出库必须同时明确：批次来源（PPL）与收货门店；同一批次余量可以按门店拆成多张出库单。
- 创建弹窗保持无弹窗级滚动条：备注改单行，顶部出库信息与左右列表有固定间距，内部列表/明细各自滚动。

### 交付
- **数据**：新增 `prepped_stock_batches`（PPL + sourceType + sourceId 唯一），追踪 planned / produced / current 双单位；`OutboundOrder.productionPlanId` 记录批次来源。迁移 `20261124160000` 按台账净额初始化历史批次余量，并回填历史出库单 PPL 来源。
- **库存事务**：`applyStockChange` 支持批次上下文；生产入库写批次，批次出库/作废回滚同事务维护批次余量 + 总库存，均条件更新防超发。
- **API**：新增 `GET /api/outbound-orders/production-batches` 分页返回已完成且余量 >0 的 PPL；报价支持 `productionPlanId`；创建接口要求 `storeId` 必选，`scheduleId / productionPlanId` 二选一。
- **前端**：右侧来源工具栏加「切配单 / 排程单」切换，默认切配单；左侧收货门店，切配单卡片展示 PPL、日期、N 种和余量。选中后点击下一步，明细默认回显切配单余量或排程建议出库数。
- **状态联动**：批次全部发完后来源排程回写已完成；作废批次单且批次余量恢复后，来源排程回置进行中。排程模式保留一排程一有效单；若排程归属 PPL，计划行可用量会被批次余量二次限制，扣减同步落到批次。

### 验证
- `npx tsc --noEmit` 0 error；出库/批次/状态定向 Jest 通过；ESLint 无新增 error；Prisma migrate diff 为空，迁移本地 deploy 通过。

---

## 2026-11-24 — 库存出库单两视图工作台与排程完成口径校准

### 背景与决策
- 用户要求创建出库单参照切配计划单：顶部固定出库时间与备注，左侧完整门店、右侧对应可出库排程，下一步全宽确认明细。
- 口径确认：出库时间新增字段并持久化；只有「进行中」排程可出库；出库成功后排程「已完成」，仍可销售回录；一张排程只允许一张有效出库单，作废后可重建。

### 交付
- **数据**：`OutboundOrder.outboundAt` 新增迁移 `20261124150000`；存量回填 `created_at`。迁移同步校准排程：有有效出库单的进行中排程置已完成，无有效出库单的已完成排程回置进行中。
- **服务端**：`POST /api/outbound-orders` 接受可省略 `outboundAt`、拒绝未来时间；事务内锁排程、拒绝重复有效出库、扣库存/台账/排程完成同事务；单号日期改用业务出库时间。作废出库单锁单据和排程，最后一张有效单作废后恢复排程可出库。
- **排程 API**：`GET /api/schedules?availableForOutbound=1` 强制进行中 + 有切配工单 + 未删除关联生产计划已完成。生产计划完成不再回写来源排程状态；内部生产单完成逻辑不变。
- **前端**：创建出库单删除三步向导，改为顶部出库信息 + 左门店右来源 + 全宽明细两视图（后续已增加生产批次切换）；列表/详情/打印统一展示 `outboundAt`；排程状态提示与文档同步。

### 验证
- 本次改动验证：定向 Jest 4 套件 26 用例通过；改动快照 `npx tsc --noEmit` 0 error、`npm run lint` 无新增告警；`npm run build` 通过；Prisma migrate diff 为空且本地 `migrate deploy` 通过。后续全量 verify 失败来自并行调料库改动，与本次库存/排程文件无关。

---

## 2026-11-23 — 生产模块第二轮：菜单改名「切配」+ 索引卡重构 + 新建改弹窗两视图

### 背景与决策
- 用户对 11-22 整页向导体验后提出五点修订：① 一级菜单「生产」→「切配」，页面标题「切配计划单」；② 卡片参照排菜模块拟物索引卡（`skeu-index-card` 三态换肤），编号即简称、日期盒显示创建时刻「月日-时分」、明细区 = 备注（无查看更多）、统计 = N 类 / M 份；③ 新建改回弹窗（复用排菜模块，无步进条）：备注必填、需求份数只读 + 计划切配份数可编辑（默认回显需求份数）、库存重点展示（≥ 需求给绿色「可以移除」标识 + 移除按钮）；④ 「新增净菜」→「添加切配净菜」走右侧抽屉（RecordSheet）；⑤ 无排程单也可直接建单（纯手工切配计划）。
- 已确认：编号规则 `PPL-月日-时分`（同分钟冲突 `-N` 后缀）；新建/编辑都走同款弹窗，删除整页向导。

### 交付
- **服务端**：`production-plan` schema——`remark` 必填、`scheduleIds` min(0) + superRefine（空排程时要求至少一行份数 > 0）；preview query schema 允许空；`nextProductionPlanCode(tx)` 改为创建时刻规则；列表 API 增 `categoryCount` / `totalPortions` 计算字段；preview API 增全量 `stockMap` / `stockById`；标题文案 `切配中心·周X（M月d日）切配计划`。
- **前端**：新弹窗 `production-plan-create-dialog.tsx`（workbench 两视图 picking + 抽屉加净菜）；**删除** `production-plan-wizard.tsx`、`wizard-steps.tsx`、`/production-plans/new`、`[id]/edit`；卡片重写为索引卡（label 切配中心 / 编号 / 创建时间日期盒 / 备注区 / N 类 M 份 / 待生效 = 编辑 + 确认生产）；列表页 URL 参数 `?create=1&date=` / `?scheduleId=` / `?editId=` 驱动弹窗；详情页「修改」就地开弹窗；侧栏「生产」→「切配」；排程详情 / 首页 / 打印 / 标签文案同步。

### 验证
- `npx tsc --noEmit` 0 error；定向 Jest（编号 / 标题 / utils / schema）全绿。

### 后续修订（2026-11-23 用户反馈）
- 卡片：索引卡基类去掉 262px 固定最小高度（切配/排菜统一，不足 3 行即收缩，self-start 不被同行拉齐）；日期盒改展示生产日期；中间区改来源门店 + 需求份数行（超 3 行可展开），门店行下方弱化备注贴底；完成生产文案改「完成切配」；编号规则改 `PPL-年月日-时分`（如 PPL-20261126-1230）。
- 逻辑修复：`lockSchedulesForProductionPlan` 空数组放行——不选排程单可完整创建纯手工切配计划（此前提交被「请至少选择一张排程单」拦截）。
- 剩余页面 skeu 化（对照排菜）：详情页（SkeuButton / PageTabs / skeu 提示条 / 确认弹窗）、预览弹窗（SkeuButton / PageTabs / workbench 定高）、完成切配弹窗（SkeuSearch / SkeuSegmented / skeu 表格容器与汇总条）、来源排程与内部生产页签（skeu-panel 体系）；打印/标签页保持纯纸面风格不动。
- 全量 verify：73 套件 / 390 用例全绿（含本轮 skeu 批次与空排程放行修复）。

---

## 2026-11-23 — 进行中单据「作废」回退待生效（排菜 + 切配）

### 背景与决策
- 用户要求：排菜与切配模块中，进行中的单据可在**预览弹窗与详情页**作废，作废后回退「待生效」恢复编辑。
- 用户拍板两道守卫：① 已有切配完成记录（净菜已入库 / 工单已回写实际量）→ 禁止作废；② 排程单已纳入未删除切配计划单 → 禁止作废。

### 交付
- 新端点 `PUT /api/schedules/[id]/void`、`PUT /api/production-plans/[id]/void`：事务 + 行锁 + logOperation；状态校验（仅进行中）、完成记录守卫、排程单纳入计划守卫；409 冲突提示。权限复用既有 `/api/schedules`、`/api/production-plans` 前缀登记（写 = admin/chef）。
- 前端四处入口（ghost 危险样式「作废」+ compact 确认弹窗）：排程详情页、排程预览弹窗、切配详情页、切配预览弹窗；成功后回显「待生效」或刷新详情。
- 文档：`app/api/schedules/CLAUDE.md` 状态机补作废回流；`memory-bank/Database.md` 增补作废规则。

### 验证
- `npx tsc --noEmit` 0 error；全量 verify 随后随用户实测一并跑。

---

## 2026-11-22 — 生产模块改造：生产计划单两步向导 + 内部生产单下线

### 背景与决策
- 原「新建生产计划单」单弹窗 + 独立的「内部生产单」前置单据，流程冗余：业务正确路径是切配中心先合并进行中门店排程得出净菜清单，再按需微调生成计划单。
- 用户拍板四项：① 内部生产单**下线页面**，模型与历史数据保留可读；② 第二步修改/新增净菜后切配工单与采购计划**全部按修改后重算**（delta 并入原料毛需求）；③ 库存信息**仅参考展示**不抵扣；④ 排程选择**不按生产日期过滤**，搜索支持门店名 / 单号 / 菜品名。

### 交付
- **新建整页向导** `/production-plans/new`（`production-plan-wizard.tsx` + 通用 `app/components/ui/wizard-steps.tsx`）：第一步 生产日期 + 备注（新字段 `production_plans.remark`，迁移 `20261122160514_production_plan_remark`）+ 双栏选排程；第二步 合并净菜行内改份数（step 0.5）+ 手工追加净菜（`origin: "manual"`，基线份数落 `originalPortions`）+ 库存参考列 + 超基线「只入库不回写门店」提示。编辑页 `[id]/edit` 复用同一组件走 PUT；预览端点 `GET /api/production-plans/preview`（静态段优先于 [id]）。
- **`buildProductionPlanData(prisma, scheduleIds, adjustments)`** 重写：删全部 selfOrder 逻辑；行级 delta = `(finalPortions − basePortions) × packageSpec × 100 ÷ yieldRate` 并入采购（clamp ≥0），与历史内部生产单折算同构；新增 `planAdjustmentsFromCuttingJson()` 供规格变更重算还原用户调整。`PlanCuttingRow` 增加 `origin` / `originalPortions`。
- **内部生产单下线**：列表/详情页、新建/编辑/激活路由、`production-module-switcher`、出库新建页切配中心卡片全删；API 仅留 GET 只读（历史计划单「内部生产」页签依赖）；`createOutboundSchema.superRefine` 拒绝 `selfOrderId` 并给下线文案；`access-control` API 分支改 `return !write`。
- `/api/schedules` 的 `q` 扩展为 title / code / 门店名 / 菜品名 OR 搜索。
- 测试：`production-plan-utils` 重写（7 用例覆盖手工行/覆盖+delta/调零 clamp/出成率 0/缺封装规格拒绝/无来源原料）+ `planAdjustmentsFromCuttingJson` + schema 与权限用例更新。

### 验证
- `npx tsc --noEmit` 0 error；`npm run verify`（tsc + ESLint + Jest 73 套 / 380 用例）全绿。
- 发布档：`npm run build` 通过；`prisma migrate diff` 零差异校验输出空迁移。
- 兼容：历史 v2 快照单（含自产数据）详情/打印/标签零改动；编辑历史单时 `cuttingJson` 行份数作 adjustments 提交，delta 重算在数学上还原采购。

### 恢复方式
内部生产单模型/API/渲染代码均保留；恢复需重建页面与写路由（可参考 git 历史），并把计划单向导第二步的手工行能力评估是否保留双轨。

---
---
## 2026-11-21 — 调料口径回退：菜品 BOM 改回「直接选调料 + 填克数」

### 背景与决策
- 「调料转标准规格」（`standard_seasonings`，2026-11-20 上线）参照「原料→净料」链路设计，与实际业务不符：调料实际是「按克用量直接计成本」。
- 用户拍板三项：① 克数在「选择弹窗填默认值 + BOM 行内再改」两处输入；② 只隐藏 UI 入口，API / 表 / 代码保留可随时恢复；③ 成本按每斤单价（元/斤）口径，不引入毛利与加工费。
- 数据盘点（只读）：本地 `dish_seasoning_details` 4 行、生产 1 行，`spec_id` 全为 null（正是「每斤单价 × 克需求」旧口径）；`standard_seasonings` 2 条且无任何 BOM 引用 → **无需数据迁移、无 schema 变更**。

### 交付
- **下线入口**：新增 `app/components/ingredients/standard-seasoning-flag.ts`（`STANDARD_SEASONING_ENABLED = false`）；调料清单「转调料」按钮、详情抽屉「查看封装调料」与「转调料」全部由该开关隐藏。`/api/standard-seasonings`、`standard_seasonings` 表、既有记录与组件文件保留未删。
- **菜品 BOM 前端**：调料 Tab 改走 `/api/ingredients?kind=seasoning&pageSize=100`（来源调料 + 每斤单价 + 采购规格）；选择弹窗列改为「名称 / 采购规格 / 每斤单价」（去掉份量与标准规格价），底部新增「用量 ___ g」（默认 10g）；BOM 调料行第 4 列改为克数输入框（改动即时重算行成本与总额）；`dishToBom` 取存储克数、`bomToPayload` 只输出 `sourceId / amountG / brand`。
- **服务端口径统一**：BOM 写入只接受 `sourceId + amountG`（`specId` 从 zod schema 移除，旧客户端字段被自动 strip），并校验来源调料属 SEA 体系；`dish-costing` / `schedule-utils` / `dish-variant` 删除规格化分支 —— 调料成本 = 每斤单价 × 克需求 ÷ 500，采购毛需求 = 克需求 × 道数（出成率 100）；菜品详情接口的调料行统一返回来源调料名称 / 采购规格 / 每斤单价。
- **顺带修掉的一致性问题**：酱料配方的调料选择器复用同一弹窗却渲染标准规格列（恒显示「—」），随列定义调整一并修正。

### 验证
- `npx tsc --noEmit` 0 error；`npm run lint` 0 error；jest 71 套 / 366 用例全过（新增 BOM 路由调料口径用例 5 条、dish-form 调料口径用例 5 条；改写 BOM 行与调料详情抽屉既有用例）。
- 无 schema 变更：`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script` 输出空迁移。

### 恢复方式
把 `STANDARD_SEASONING_ENABLED` 置 `true`，并回滚菜品 BOM / 成本口径里的规格化分支即可恢复调料标准化。

---

## 2026-11-20（部署）— 调料标准化 v1 + 版式对齐 已上线生产

### 部署
- 提交链：`1dcefec`（feat 调料标准化）→ `f00daff`（fix proxy 登录 404）→ `6e401c1`（docs）→ `177075f`（refactor 版式对齐）→ `b903e49`（docs）
- 两次 `workflow_dispatch`：run `44588399867` @ `6e401c1`、run `44591874740` @ `b903e49`，均 build → deploy-prebuilt → health 全绿
- web 镜像 tag = `b903e4951b8b6c5072231a71610bfe8d5f52d012`（ACR 预构建路径）

### 部署前审计
- 迁移 `20261120100000_add_standard_seasonings`：仅 CREATE TABLE + ADD COLUMN + CREATE INDEX + ADD FOREIGN KEY，**无 UPDATE/DELETE 碰业务表**
- seed：仅补缺失（分类/单位/门店/包装/首个管理员），**不触碰 standard_seasonings 与 dish_seasoning_details**
- 生产只读盘点（部署前）：ingredients 91 / net_ingredients 138 / dishes 12 / dish_seasoning_details 1 / users 3；standard_seasonings 表不存在，spec_id 列不存在

### 部署后复核（只读）
- 服务器 HEAD = `b903e49`；backup / db / web 均 running；migrate 容器 `Exited(0)`
- 数据基线逐项一致：91 / 138 / 12 / 1 / 3，无任何行数变化
- `standard_seasonings` 表已创建；`dish_seasoning_details.spec_id` 列已创建
- `/login` HTTP 200，`/api/health` 返回 `{"status":"ok"}`；web 近 5 分钟无 error 日志

### 推送通道备忘（重要）
- 本机直连 `github.com:443` 时通时不通；服务器 origin 指向 `gh-proxy.com` 第三方中继
- **不要**为图省事把本机 GitHub 凭据经第三方中继转发（token 与私有仓库内容会暴露给中继）
- 正确做法：直连 `https://github.com/...` 推送（凭据只发往 GitHub 官方域名），失败时重试或让用户执行 `git push`
- 部署触发走 GitHub 官方 REST API（`api.github.com` 的 `workflow_dispatch`），不经中继
- **本地 dev 与生产构建不要混用 `.next`**：先跑过 `npm run build` 再 `npm run dev` 时，`.next` 里同时存在
  生产产物与 dev 缓存，会复现「`/api/auth/*` 全部 404、登录不可用」的假故障。删掉 `.next` 重新 `npm run dev` 即恢复
  （与 proxy 的请求头修复是两件事，排查时先清缓存再怀疑代码）

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

> **归档（2026-11-22）**：2026-11-05 ~ 2026-11-15（续 3）的历史条目已拆至 `memory-bank/archive/progress-2026-11-05_14.md`，本文件只保留 2026-11-15（续 4）起的近期日志。新条目一律记在本文件顶部。

