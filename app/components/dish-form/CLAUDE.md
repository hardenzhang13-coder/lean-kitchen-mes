# 菜品表单组件（dish-form）

本目录包含菜品新建/编辑/查看的复合表单组件。它不是一个弹窗，而是一个完整的页面级组件，通常由 `app/dishes/new/page.tsx`、`[id]/edit/page.tsx` 和 `[id]/page.tsx` 使用。

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

`BOM_TYPE_REQUIRED` 定义前 4 类为发布必填，`sauce` 为可选。

### 表单三模式

`DishFormProps.mode` 支持：

- `new` — 新建菜品，显示"保存草稿"和"发布"按钮
- `edit` — 编辑已有菜品
- `view` — 查看模式，允许在草稿状态下点击"发布"或"编辑"

### 数据转换函数

- `dishToFormData(dish)` — 服务端菜品对象 → 基础信息表单
- `dishToBom(dish)` — 服务端四层明细 → 客户端 BOM 状态
- `dishToProcesses(dish)` — 服务端工序 → 客户端工序状态
- `bomToPayload(bom)` — 客户端 BOM 状态 → API 提交载荷
- `validatePublish(form, bom)` / `validateDishDetailForPublish(dish)` — 发布前校验
- `calcCost(unitPrice, amountG)` — 按 `unitPrice * amountG / 1000` 计算单条成本
- `totalBomCost(bom)` — 汇总 BOM 总成本

## 保存/发布流程

`DishForm` 的提交逻辑分为三步 API 调用：

1. **创建或更新基础信息**：`POST /api/dishes` 或 `PUT /api/dishes/[id]`
2. **保存 BOM**：`PUT /api/dishes/[id]/bom`
3. **保存工序**：`PUT /api/dishes/[id]/processes`

### 新建菜品

- 先以 `status: "draft"` 创建菜品
- 再保存 BOM 和工序
- 如果选择"发布"，最后再 `PUT /api/dishes/[id]` 将 `status` 改为 `"published"`

### 编辑菜品

- 直接保存 BOM 和工序，再更新基础信息
- 已发布菜品在 `PUT /api/dishes/[id]` 中会被拒绝修改基础信息/BOM/工序，只能先"下架"回 `draft`

### 查看模式发布

- 在 `view` 模式下，用户可以先浏览，再点击"发布"
- 此时会重新拉取详情做服务端校验（`validateDishDetailForPublish`），通过后再改状态

## 发布校验规则

基础信息必填：名称、类别、菜系、做法、口味、荤素类型。  
BOM 必填：主料、辅料、调料均至少 1 项。小料和酱料不强制。

> 提示：发布后会锁定菜品，前端 `isReadOnly = localStatus === "published" || mode === "view"` 控制表单只读。

## 食材加载策略

`handleLoadItems` 根据 BOM 类型调用不同 API：

- `main` / `support` / `minor` → `/api/net-ingredients?excludeMinor=true（可选）`
- `seasoning` → `/api/ingredients`
- `sauce` → `/api/sauce-ingredients`

返回数据通过 `normalizeNetIngredients` / `normalizeIngredients` / `normalizeSauces` 统一成 `IngredientOption`。

## 工序编辑

工序分为四个阶段：

1. 初加工
2. 预处理
3. 上灶加工
4. 出锅成品

`ProcessEditor` 内部按阶段折叠展示，支持同阶段内上下移动、删除、编辑。  
加工对象（`object`）默认从主料/辅料名称自动生成，可下拉选择或手动输入。

## 注意事项

- 不要在前端直接修改 `status === "published"` 菜品的数据状态，所有写操作都会走 API 校验。
- BOM 成本在前端即时估算，真实成本以服务端 `PUT /api/dishes/[id]/bom` 重新计算为准。
- 服务端 `DELETE /api/dishes/[id]` 也会拒绝删除已发布菜品。
