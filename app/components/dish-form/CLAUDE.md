# 菜品表单组件（dish-form）

本目录包含菜品新建/编辑的复合表单组件。它不是一个弹窗，而是一个完整的页面级组件，由 `app/dishes/new/page.tsx` 与 `[id]/edit/page.tsx` 使用。查看详情不再是表单的只读模式：`app/dishes/[id]/page.tsx` 渲染展示型组件 `app/components/dishes/dish-detail-view.tsx`。

## 组件结构

| 文件 | 职责 |
|------|------|
| `index.tsx` | `DishForm` 主组件，整合基础信息、BOM、工序三大块，管理保存/发布/下架流程 |
| `types.ts` | 全目录共享的类型定义、常量、数据转换与校验函数 |
| `basic-info-panel.tsx` | 菜品基础信息表单（名称、类别、菜系、做法、口味等） |
| `bom-editor.tsx` | BOM 编辑器，按 5 类食材分组管理 |
| `bom-item-row.tsx` | 单条 BOM 用料的输入/展示行 |
| `bom-picker-dialog.tsx` | 食材选择弹窗，按分类级联搜索 |
| `process-editor.tsx` | 工序编辑器，按 4 个加工阶段分组 |
| `process-step-card.tsx` | 工序步骤卡片（只读/编辑） |
| `process-step-form.tsx` | 工序步骤内联编辑表单 |

## 核心类型（types.ts）

### BOM 五层结构

```ts
type BomType = "main" | "support" | "minor" | "seasoning" | "sauce";
```

- `main` — 主料（对应 `DishNetDetail.role === "main"`）
- `support` — 辅料（对应 `DishNetDetail.role === "support"`）
- `minor` — 小料（对应 `DishMinorDetail`）
- `seasoning` — 调料（对应 `DishSeasoningDetail.type === "seasoning"`）
- `sauce` — 酱料（对应 `DishSauceDetail`）

`BomType` 前 4 类有对应明细表，`sauce` 为可选。发布只要求主料至少 1 项，其余用料均不强制。

### 表单模式

`DishFormProps.mode` 支持：

- `new` — 新建菜品，显示"保存草稿"和"发布"按钮
- `edit` — 编辑已有菜品；非草稿态只显示"下架"

### 数据转换函数

- `dishToFormData(dish)` — 服务端菜品对象 → 基础信息表单
- `dishToBom(dish)` — 服务端四层明细 → 客户端 BOM 状态
- `dishToProcesses(dish)` — 服务端工序 → 客户端工序状态
- `bomToPayload(bom)` — 客户端 BOM 状态 → API 提交载荷
- `validatePublish(form, bom)` / `validateDishDetailForPublish(dish)` — 发布前校验
- `calcCost(type, pricePerJin, amountG)` — 按 `pricePerJin * amountG / 500` 计算单条成本（元/斤口径，1 斤 = 500g）
- `totalBomCost(bom)` — 汇总 BOM 总成本

## 保存/发布流程

`DishForm` 的提交逻辑分为三步 API 调用：

1. **创建或更新基础信息**：`POST /api/dishes` 或 `PUT /api/dishes/[id]`
2. **保存 BOM**：`PUT /api/dishes/[id]/bom`
3. **保存工序**：`PUT /api/dishes/[id]/processes`

### 新建菜品

- 先以草稿（服务端强制 `status: "draft"`）创建菜品
- 再保存 BOM 和工序
- 如果选择"发布"，最后调用 `POST /api/dishes/[id]/status`，action 为 `"publish"`

### 编辑菜品

- 直接保存 BOM 和工序，再更新基础信息
- 只有草稿可编辑；已发布/已停用菜品会被拒绝修改基础信息/BOM/工序，必须先"下架"回 `draft`

> 查看与发布操作在展示型详情页 `DishDetailView` 完成，不在本表单内。

## 发布校验规则

基础信息必填：名称、荤素类型、售价（元/份）。类别、菜系、做法、口味均可留空。  
BOM 必填：主料至少 1 项。辅料、小料、调料和酱料不强制。

- 售价必填在 `validateForSave`（保存草稿）与 `validatePublish`（发布）中共用：缺失时提示「请填写售价（元/份），毛利率会根据成本自动计算」。
- 毛利率不入库，由「售价 + 当前成本」实时派生；发布时成本缺失会提示先添加主料。售价与毛利率在表单标题上以主题色加粗并标注必填。
- 份量默认值：`单人份`（新建表单、存量缺省回退、`createDishSchema` 与 `dishes.portion` 列默认值一致）；份量选项唯一来源是份量档案（设置模块「份量」），经 `usePortionProfiles` 拉取；净料/调料档案的份量默认取档案中倍率=10 的首个启用行（历史口径 小碗菜·10份）。

> 提示：发布后会锁定菜品，前端 `isReadOnly = localStatus !== "draft"` 控制表单只读。

## 食材加载策略

`handleLoadItems` 根据 BOM 类型调用不同 API：

- `main` / `support` / `minor` → `/api/net-ingredients?excludeMinor=true（可选）`
- `seasoning` → `/api/ingredients?kind=seasoning&pageSize=100`（来源调料 + 每斤单价）
- `sauce` → `/api/sauce-ingredients`

返回数据通过 `normalizeNetIngredients` / `normalizeIngredients` / `normalizeSauces` 统一成 `IngredientOption`。

### BOM 用量口径（2026-11）

- **净料/小料**：选择后**不手填用量**，直接采用档案的封装规格 `packageSpec` 作为 `amountG`；客户端传入的 `amountG` 会被服务端忽略（`resolveNetBomAmountG`）。规格变更后 BOM 用量与成本自动同步。
- **调料**（2026-11-21 起）：直接选**采购调料**（SEA 体系），**手填克数**，服务端按 `sourceId + amountG` 原样写入，成本 = 每斤单价 × 克数 ÷ 500。
  - 选择弹窗底部提供「用量 ___ g」（默认 10g，`defaultAmountG="10"`），BOM 行内可逐条改克数并即时重算行成本。
  - 调料行不展示份量（份量只属于净料/小料口径）。
- **酱料**：沿用原口径（配方克数）。
- 菜品 BOM 添加为**单选**，选择弹窗不提供「取消」按钮，已选摘要与「确认选择」统一放在底部操作行。
- 选择弹窗的搜索范围只匹配食材名称字段（不匹配编号、商品名称），与食材库列表口径一致。
- 选择弹窗**完整复用标准列表外框**：`skeu-panel`（工具条 + 表体 + 吸底分页）+ `ListToolbar` 搜索 + `CategoryCascadeSelect` 级联分类筛选（默认「全部分类」取该类型全部食材）；标题与搜索区留间距；选中行浅橙底（`data-selected` CSS 规则）+ ✓ + 主题色序号，选中状态必须醒目。
- 估算成本在「菜品用量」模块标题处以主题色加粗展示。
- `BomPickerDialog` 的 `showAmountInput` 默认 `true`、`singleSelect` 默认 `false`，供酱料配方编辑器复用；菜品 BOM 传 `showAmountInput={pickerType === "seasoning"} singleSelect`。

## 工序编辑

工序分为四个阶段：

1. 初加工
2. 预处理
3. 上灶加工
4. 出锅成品

`ProcessEditor` 内部按阶段折叠展示，支持同阶段内上下移动、删除、编辑。  
加工对象（`object`）默认从主料/辅料名称自动生成，可下拉选择或手动输入。

## 注意事项

- 不要在前端直接修改菜品状态，所有状态流转走 `POST /api/dishes/[id]/status`。
- `isReadOnly = localStatus !== "draft"`：已发布/已停用均不可编辑。
- BOM 成本在前端即时估算，真实成本以服务端 `PUT /api/dishes/[id]/bom` 重新计算为准。
- 服务端 `DELETE /api/dishes/[id]` 也会拒绝删除已发布菜品。
