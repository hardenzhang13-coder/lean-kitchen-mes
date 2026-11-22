# 采购模块与食材库业务流统一修复需求文档

> 本文档作为 Claude Code 的完整执行需求输入，涵盖 4 项修复/优化。请按本文档描述的业务逻辑、交互规范、数据变更要求执行实现，代码层面的设计与执行由 CC 的 plan 模式自主完成。

---

## 一、需求总览

| 编号 | 需求 | 类型 | 优先级 | 说明 |
|------|------|------|--------|------|
| 1 | 原料/调料名称重复校验 | 修复 | P1 | 全链路无校验，名称可任意重复 |
| 2 | 调味品/调料分类无法选择 | 修复 | P1 | 交互阻断，选择后被 useEffect 强制重置 |
| 3 | 匹配正常时入库数据计算与回显 | 修复 | P2 | 3 处数据流断裂 |
| 4 | 批量导入入口禁用 | 新增 | P3 | 点击提示"正在开发中" |

---

## 二、详细需求说明

### 需求 1：原料/调料名称重复校验

#### 现状问题
经排查，原料和调料清单在创建、更新、批量导入 3 个入口均无 `name` 重复校验。数据库 Schema 中 `Ingredient.name` 和 `SeasoningIngredient.name` 均无 `@unique` 约束，代码层也未做前置校验。这导致同一食材可以被多次录入，破坏食材库作为系统标准数据字典的权威性。

#### 目标业务逻辑
1. **原料表（`ingredients`）** 和 **调料表（`seasoning_ingredients`）** 内部各自的 `name` 字段在 `deletedAt IS NULL` 范围内必须唯一。
2. **原料与调料之间**：因业务逻辑上调料只是食材分类体系下的一个分支，两者名称不应出现冲突（即原料表中有"生抽"，调料表中也不能有"生抽"）。所以校验范围应合并两表。
3. 校验触发点：
   - 单条创建 API（`POST /api/ingredients`、`POST /api/seasoning-ingredients`）
   - 单条更新 API（`PUT /api/ingredients/[id]`、`PUT /api/seasoning-ingredients/[id]`）
   - 批量导入 API（`POST /api/ingredients/import`）—— 虽然需求 4 禁用了前端入口，但后端 API 仍需校验
   - 前端表单保存前（`IngredientFormDialog` 提交前）也应有前端重复校验提示，减少无效请求
4. 校验规则：忽略大小写和前后空格，只校验未删除（`deletedAt: null`）的记录。更新时排除自身 ID。
5. 错误提示统一格式：`{ code: 400, message: "食材名称已存在" }`（中文，用户可见）。

#### 涉及范围
- `app/api/ingredients/route.ts`（POST）
- `app/api/ingredients/[id]/route.ts`（PUT）
- `app/api/ingredients/import/route.ts`（POST）
- `app/api/seasoning-ingredients/route.ts`（POST）
- `app/api/seasoning-ingredients/[id]/route.ts`（PUT）
- `app/components/ingredient-form-dialog.tsx`（前端提交前校验）
- `app/ingredients/raw/page.tsx`（导入入口的禁用改造，见需求 4）

#### 注意事项
- 不要对数据库增加 `@unique` 约束（因为软删除场景下唯一约束会失效，且需要跨表校验）。纯代码层校验即可。
- 批量导入时，如果导入数据中自身存在重复名称，也需要拦截（一次性导入多条"带皮五花肉"应报错）。
- 校验查询使用 `findFirst` 即可，不需要索引变更。

---

### 需求 2：调味品/调料分类无法选择

#### 现状问题
在 `IngredientFormDialog`（新增/编辑食材弹窗）中，当用户选择一级分类"调味品"后，二级分类"调料"无法被成功选中——点击后立刻被重置为空。根因是 `useEffect` 的依赖列表包含了 `isSeasoning`，而 `isSeasoning` 在选中"调料"后从 `false` 变为 `true`，触发 `useEffect` 重新执行，将 `l2Code` 重置回 `initialData.l2Code`（空值）。

相关代码：
- `app/components/ingredient-form-dialog.tsx` 第 180~198 行：初始化 `useEffect`
- `app/components/ingredient-form-dialog.tsx` 第 163~166 行：`isSeasoning` 计算逻辑

#### 目标业务逻辑
1. 弹窗内的表单状态在打开后不应因 `isSeasoning` 变化而被重置。
2. `useEffect` 的职责应仅限于：弹窗打开时，根据 `initialData` 做一次性表单初始化。之后的所有用户交互（选择一级分类、二级分类）都不应触发这个初始化 `useEffect` 重新执行。
3. 方案建议：将 `useEffect` 的依赖从 `[open, initialData, categories, isSeasoning, findParentL1]` 精简为仅 `[open, initialData]`，并确保 `isSeasoning` 变化不触发状态重置。如果 `isSeasoning` 需要影响表单默认值（如别名/品牌标签切换），应通过独立逻辑处理，而不是依赖同一个初始化 `useEffect`。

#### 涉及范围
- `app/components/ingredient-form-dialog.tsx` 唯一文件

#### 注意事项
- 修改后需验证所有分类的正常选择：原料分类（如 MEA-POR 猪肉）、调料分类（SEA-SEA）、以及其他一级分类下的二级分类。
- 不要破坏 `mode` 参数的逻辑（`mode: "ingredient" | "seasoning" | "auto"`），`filteredCategories` 的过滤逻辑应保留。

---

### 需求 3：匹配正常时入库数据计算与列表回显

#### 现状问题
共发现 3 处数据流断裂：

**断裂点 A：新增/编辑食材后，采购列表回显不完整**
- `handleIngredientSuccess`（`app/purchases/new/page.tsx` 第 545~574 行）在将新创建/编辑的食材回写到采购列表时，缺少 `spec` 字段回写，且未根据食材库标准数据重新计算 `stockInQty`。
- `CreatedIngredient` 类型缺少 `purchaseSpec` 字段，导致即使后端返回了规格，前端也无法接收。

**断裂点 B：编辑弹窗展示的是采购快照，不是食材库最新标准数据**
- `openEditDialog`（`app/purchases/new/page.tsx` 第 577~579 行）直接复制 `item` 到 `editForm`，没有重新读取食材库。如果食材库已更新，编辑弹窗仍展示旧数据。

**断裂点 C：AI 识别后的入库计算未使用食材库标准 `purchaseSpec`**
- `applyRecognition`（`app/purchases/new/page.tsx` 第 360~421 行）在计算入库数量时，使用 AI 识别返回的原始 `spec`，而不是从食材库读取的标准 `purchaseSpec`。

#### 目标业务逻辑
**核心原则**：食材库是系统标准数据，采购明细在匹配正常后，所有标准属性（名称、规格、品牌、单位、储存方式）必须读取食材库的最新值。入库数量必须根据食材库的标准 `purchaseSpec` + 当前 `qty` 自动计算。

具体规则：
1. **`CreatedIngredient` 类型扩展**：增加 `purchaseSpec`（采购规格）字段，允许 `string | null`。
2. **`handleIngredientSuccess` 补全回显**：
   - 回写 `spec`：优先使用食材库的 `purchaseSpec`，其次保留原值。
   - 回写 `stockUnit`：使用食材库标准 `stockUnit`。
   - **重新计算 `stockInQty`**：根据食材库 `purchaseSpec` + 当前 `qty` 调用 `calculateStockInfo` 重新计算。如果 `purchaseUnit === "斤"`，则 `stockUnit = "斤"`，`stockInQty = qty`。
   - 回写 `storage`：使用食材库标准 `storage`。
3. **`openEditDialog` 读取食材库最新数据**：
   - 如果 `item.matched === true`，先异步查询对应食材库 API（`GET /api/ingredients/{id}` 或 `GET /api/seasoning-ingredients/{id}`），获取最新标准数据后填充 `editForm`。
   - 如果 `item.matched === false`，保持现有行为（直接复制 `item`）。
4. **`applyRecognition` 中匹配项使用标准规格**：
   - 对于 `matched: true` 的项，在计算 `stockInfo` 时，优先使用食材库标准 `purchaseSpec`（来自 `ingMatch`/`seaMatch`），而非 AI 识别的原始 `spec`。
   - 如果标准 `purchaseSpec` 为空，则回退到 AI 识别的原始 `spec`。
5. **入库计算统一规则**：
   - 如果 `purchaseUnit === "斤"`：直接 `stockUnit = "斤"`，`stockInQty = qty`（无需解析规格）。
   - 如果 `purchaseUnit !== "斤"` 且标准 `purchaseSpec` 非空：使用 `calculateStockInfo({ spec: purchaseSpec, qty, unitNames })` 计算。
   - 其他情况：`stockInQty = 1`。
6. **列表展示回显**：`patchItem`（`app/purchases/new/page.tsx` 第 486~524 行）和 `updateItem` 在更新字段时，如果字段为 `spec` 或 `purchaseUnit` 或 `qty`，应触发 `stockInQty` 重新计算，确保列表中实时展示最新入库数据。

#### 涉及范围
- `app/purchases/new/page.tsx`：`FormItem` 类型、`CreatedIngredient` 类型、`handleIngredientSuccess`、`openEditDialog`、`applyRecognition`、`patchItem`/`updateItem` 逻辑
- `app/api/purchase-receipts/recognize/route.ts`：确保匹配时返回食材库的标准 `purchaseSpec`（原料表的 `purchaseSpec` 或调料表的 `productSpec`）
- `app/api/ingredients/[id]/route.ts`（GET）：确保响应包含 `purchaseSpec`
- `app/api/seasoning-ingredients/[id]/route.ts`（GET）：确保响应包含 `productSpec`

#### 注意事项
- 不要破坏现有的 `isManual` 标记逻辑（手动增加的条目不受 AI 识别影响）。
- 重新计算 `stockInQty` 时，如果用户已手动修改过 `stockInQty`，应保留用户手动值（除非触发重新计算的字段变化）。当前 `patchItem` 逻辑中 `spec`/`qty`/`purchaseUnit` 变化时会自动重新计算，这个行为保留。
- `calculateStockInfo` 来自 `lib/spec-parser.ts`，不要修改其核心算法，只调整调用时的输入参数。

---

### 需求 4：批量导入入口禁用

#### 现状问题
原料清单页面（`app/ingredients/raw/page.tsx`）右上角有"批量导入"按钮，点击后打开 `ImportDialog`，但当前后端导入逻辑无名称重复校验，且导入功能未经过完整验收。

#### 目标业务逻辑
1. 原料清单页面的"批量导入"按钮（第 258~261 行）点击后不再打开 `ImportDialog`，而是弹出 `toast.info("正在开发中")` 提示。
2. 按钮样式保持 `variant="outline"`，但文案可改为"批量导入（开发中）"或保持"批量导入"（仅点击行为改变）。
3. 不需要删除 `ImportDialog` 组件或导入相关代码，仅禁用入口即可（后续恢复时方便）。

#### 涉及范围
- `app/ingredients/raw/page.tsx`：修改按钮 `onClick` 行为

#### 注意事项
- 调料清单页面（`app/ingredients/seasoning/page.tsx`）没有批量导入按钮，无需修改。
- 后端 API（`POST /api/ingredients/import`）保留，不做删除，但前端不再调用。

---

## 三、数据模型变更

本次修复 **不新增数据库表，不修改字段类型，不新增 @unique 约束**。Schema 保持不变。

唯一涉及的数据库操作：后端校验查询（`findFirst`），不需要索引变更。

---

## 四、API 接口变更

### 1. POST `/api/ingredients` — 创建原料

**逻辑变更**：在创建前增加 `name` 重复校验（跨 `ingredients` 和 `seasoning_ingredients` 两表，均排除 `deletedAt IS NOT NULL`）。

**响应变更**：如果名称重复，返回 `{ error: "食材名称已存在" }`，HTTP 400。

### 2. PUT `/api/ingredients/[id]` — 更新原料

**逻辑变更**：在更新前增加 `name` 重复校验（排除自身 ID，跨两表）。

**响应变更**：同上。

### 3. POST `/api/seasoning-ingredients` — 创建调料

**逻辑变更**：在创建前增加 `name` 重复校验（跨两表）。

**响应变更**：如果名称重复，返回 `{ error: "食材名称已存在" }`，HTTP 400。

### 4. PUT `/api/seasoning-ingredients/[id]` — 更新调料

**逻辑变更**：在更新前增加 `name` 重复校验（排除自身 ID，跨两表）。

**响应变更**：同上。

### 5. POST `/api/ingredients/import` — 批量导入原料

**逻辑变更**：在导入前增加双重校验：
- 导入数据内部是否有重复 `name`
- 导入数据的 `name` 是否与已有原料/调料重复（跨两表，排除软删除）

**响应变更**：如果存在重复，返回 `{ error: "数据校验失败", errors: [...] }`。

### 6. POST `/api/purchase-receipts/recognize` — AI 识别

**逻辑变更**：在匹配返回的数据中，确保已匹配项携带食材库的标准 `purchaseSpec`（原料为 `purchaseSpec`，调料为 `productSpec`）。

---

## 五、交互设计与页面规范

### 5.1 `IngredientFormDialog` 弹窗

**字段顺序**（保持不变）：
1. 食材分类（一级分类 + 二级分类，TileSelect）
2. 名称（Input）
3. 别名/产品品牌（Input，标签随 `isSeasoning` 切换）
4. 采购规格（Input）
5. 采购单位（SearchableSelect）
6. 入库单位（SearchableSelect）
7. 最新参照单价（Input，可选）
8. 季节限定（TileGroup，非调料时展示）
9. 储存方式（TileGroup，非调料时展示）

**按钮行为**：
- 保存按钮：`onClick` 时先触发前端校验（名称非空、分类已选、规格非空、单位已选），再触发名称重复校验（异步查询），最后提交后端。
- 如果名称重复，toast 提示"食材名称已存在"，阻止提交。

**右侧列表**（保持不变）：展示当前二级分类下已存在的食材列表。

### 5.2 采购录入页面（`app/purchases/new/page.tsx`）

**编辑弹窗回显规则**：
- 点击"编辑"按钮后，如果该行 `matched === true`，先显示 loading 状态（或短暂延迟），然后弹窗内展示食材库最新标准数据。
- 弹窗内字段：`itemName`、`brand`、`spec`、`qty`、`purchaseUnit`、`unitPrice`、`amount`、`stockUnit`、`stockInQty`。
- `amount` 为只读（自动计算）。

**列表实时回显**：
- 当用户在列表中修改 `spec`、`qty`、`purchaseUnit` 时，`stockInQty` 自动重新计算并展示最新值。
- 当用户在列表中修改 `stockUnit` 时，如果规格可解析，也重新计算 `stockInQty`。

---

## 六、技术约束与红线

- ❌ 禁止新增 `any` 类型
- ❌ 禁止无分页的列表 API（本次修复不涉及新增列表 API）
- ✅ 所有 API 修改需包含输入校验（如必要）和错误处理（`{ code, message }` 格式）
- ✅ 操作日志（`logOperation`）在已有 API 中已覆盖，新增校验逻辑不需要额外日志
- ✅ 采购单入库操作已有 `prisma.$transaction` 包裹，本次修复不修改事务逻辑
- ✅ Schema 无需变更，不需要 `prisma migrate dev`
- ✅ 代码提交前强制检查顺序：`npx tsc --noEmit` → `npm run build` → `npm run lint`

---

## 七、验收标准

| 编号 | 验收项 | 验收标准 | 验证方式 |
|------|--------|----------|----------|
| 1 | 原料名称重复校验 | 在原料清单中新建"带皮五花肉"，再建一次同名，系统阻止并提示"食材名称已存在" | 前端弹窗操作 + 后端 API 测试 |
| 2 | 调料名称重复校验 | 在调料清单中新建"海天金标生抽"，再建一次同名，系统阻止并提示"食材名称已存在" | 前端弹窗操作 + 后端 API 测试 |
| 3 | 跨表名称冲突校验 | 原料表中已有"生抽"，调料表中尝试新建"生抽"，系统阻止 | 前端/后端 API 测试 |
| 4 | 更新时排除自身 | 编辑原料"带皮五花肉"，保持名称不变，可以正常保存 | 前端编辑操作 |
| 5 | 调味品/调料可选 | 在新增食材弹窗中，选择一级分类"调味品"，再选择二级分类"调料"，选择成功且不被重置 | 前端操作 |
| 6 | AI 识别匹配后使用标准规格 | 食材库中"带皮五花肉"标准规格为"1kg*10袋"，AI 识别返回规格为"散装"，匹配后采购列表中 `spec` 应显示标准规格"1kg*10袋"，且 `stockInQty` 按标准规格计算 | 上传图片 AI 识别后检查列表数据 |
| 7 | 新增食材后列表回显 | 在采购列表中点击"新增食材"创建新食材，保存后列表中该行的 `spec`、`stockUnit`、`stockInQty` 应正确回显食材库标准值 | 前端操作 |
| 8 | 编辑弹窗读取最新数据 | 在食材库中修改某食材的规格，然后在采购列表中点击该食材的"编辑"，弹窗中应展示修改后的最新规格 | 前后端联动测试 |
| 9 | 列表修改自动重算入库 | 在采购列表中修改某行的 `spec` 或 `qty` 或 `purchaseUnit`，`stockInQty` 应自动重新计算并展示 | 前端操作 |
| 10 | 批量导入禁用 | 在原料清单页面点击"批量导入"按钮，弹出 toast 提示"正在开发中"，不打开导入弹窗 | 前端操作 |
| 11 | 编译检查 | `npx tsc --noEmit` 无报错 | 命令行 |
| 12 | 构建检查 | `npm run build` 成功 | 命令行 |
| 13 | 代码检查 | `npm run lint` 无报错 | 命令行 |

---

## 八、相关文件参考

| 文件路径 | 功能说明 |
|----------|----------|
| `app/components/ingredient-form-dialog.tsx` | 新增/编辑食材弹窗（核心修复点：useEffect 依赖、名称重复校验） |
| `app/purchases/new/page.tsx` | 采购录入页面（核心修复点：回显逻辑、编辑弹窗数据读取、入库计算） |
| `app/api/ingredients/route.ts` | 原料创建 API（需增加名称重复校验） |
| `app/api/ingredients/[id]/route.ts` | 原料更新 API（需增加名称重复校验） |
| `app/api/ingredients/import/route.ts` | 原料批量导入 API（需增加名称重复校验） |
| `app/api/seasoning-ingredients/route.ts` | 调料创建 API（需增加名称重复校验） |
| `app/api/seasoning-ingredients/[id]/route.ts` | 调料更新 API（需增加名称重复校验） |
| `app/api/purchase-receipts/recognize/route.ts` | AI 识别 API（需确保返回标准 purchaseSpec） |
| `app/ingredients/raw/page.tsx` | 原料清单页面（批量导入按钮禁用） |
| `app/ingredients/seasoning/page.tsx` | 调料清单页面（无需修改） |
| `lib/spec-parser.ts` | 规格解析与入库计算工具函数 |
| `lib/category-helpers.ts` | 调味品分类编码获取辅助函数 |
| `prisma/schema.prisma` | 数据库 Schema（无需修改） |

---

## 九、边界（不涉及）

- 不修改 `PurchaseReceipt` / `PurchaseReceiptItem` 的数据库 Schema
- 不修改库存入库事务逻辑（`prisma.$transaction` 在 `POST /api/purchase-receipts` 中的逻辑保持原样）
- 不修改 AI 识别的核心算法（`lib/ai.ts` 中的 `recognizePurchaseReceipt`）
- 不删除 `ImportDialog` 组件或批量导入后端 API，仅禁用前端入口
- 不修改单位管理、供应商管理、分类管理等其他模块
- 不修改调料清单页面的任何 UI 或逻辑（该页面无批量导入按钮）
- 不修改 `TileSelect` / `TileGroup` / `SearchableSelect` 等通用组件本身

