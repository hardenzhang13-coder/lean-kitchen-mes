---
name: domain-pricing
description: 涉及净料价格、菜品成本、出成率、单位换算、份量口径、净菜库存份数或出库金额时使用。指向仓库内唯一的计算公式与单位来源，明确「份量 portion」与「封装规格 packageSpec」的当前边界，避免复制或另写一套价格公式。
---

# 业务口径：价格 / 单位 / 份量 / 库存

这个系统里同一件事只能有一个真源。违反口径造成的错账，比功能缺失更难查。

## 三层食材模型

```
原料 Ingredient → 净料 NetIngredient（出成率 yieldRate）→ 菜品 Dish
                        ↑ 小料与净料同表，l2Code 归属 MIN 一级分类

调料 Ingredient（SEA 体系）→ 菜品 Dish（直接引用 + 克需求，不转化）
                        ↑ 调料不走标准化：成本 = 每斤单价 × 克需求 ÷ 500
```

**净料默认名称**：转净料与新增净料自动生成「原料名称•加工方式•500g」（`lib/shared/net-name.ts` 的 `buildNetIngredientDefaultName`）。「加工方式」是占位词由用户改写；用户改过就不再自动覆盖。不要在别处另拼一套命名规则。

## 价格链路（唯一真源）

`lib/server/net-ingredient-utils.ts` 的 `deriveNetIngredientPrices()`：

```
净料单价 = 来源原料每斤单价 ÷ (出成率 / 100)
成本价   = 净料单价 + 封装加工费(元/斤)
出库价   = 成本价 ÷ (1 − 毛利率 / 100)      // 毛利率空值按 0
标准规格价(元/份) = 出库价 × packageSpec(g) ÷ 500
```

- 净料单价**强制**由来源原料实时价格派生；服务端忽略客户端传入的 `unitPrice`。
- 毛利率空值统一按 0 处理，不要各自写 `?? 0` 之外的逻辑。
- 新增任何价格展示，复用 `serializeNetIngredient()` 附加的计算字段，不要在页面里重算。

## 调料（2026-11-21 口径：直接选调料 + 填克数）

调料**不转化、不标准化**，直接引用采购档案（`ingredients`，SEA 调味品体系），按克需求计成本：

```
调料 BOM 成本(元/份) = 每斤单价(元/斤) × 克需求(g) ÷ 500
调料采购毛需求(g)     = 克需求 × 道数            // 出成率 100
```

- 唯一真源：调料档案的 `pricePerJin`（每斤单价，元/斤）。BOM 写入时按 `sourceId` 校验其属于 SEA 体系，成本 = 每斤单价 × 克需求 ÷ 500。
- **克需求由用户在菜品 BOM 里手填**，服务端不覆盖 —— 与净料/小料「用量 = 档案封装规格」的口径不同，勿混用。
- 采购规格（`ingredients.purchaseSpec`，如「1.2kg/瓶」）只作对照展示，不参与任何计算；调料**无份量**。
- 采购毛需求 = 克需求 × 道数（出成率 100），不按标准规格或出成率折算。
- **调料标准化（`standard_seasonings`）暂时下线**（2026-11-21）：该表、API 与价格链（`lib/shared/seasoning-spec.ts`）保留未删，但菜品 BOM 不再引用；UI 入口由 `app/components/ingredients/standard-seasoning-flag.ts` 的 `STANDARD_SEASONING_ENABLED` 控制。恢复时置 `true` 并回滚规格化分支。

## 菜品成本（实时，不信任快照）

`lib/server/dish-costing.ts` 的 `getCurrentDishCostMap(dishIds)`：

- 净料/小料按出库价；调料按每斤单价 × 克需求 ÷ 500（不再区分标准规格口径）；酱料按配方成本 + 毛利率。
- `Dish.cost` 是历史快照，只作兜底，不作为展示依据。
- 菜品列表、菜品详情、排程详情都应走这个函数。

## 单位换算（唯一来源是字典）

- 字典表 `units` 的 `gramsPerUnit` 是唯一换算依据。
- 服务端通过 `lib/server/unit-factors.ts` 的 `getJinFactors()` / `getGramFactors()` / `getGramsPerJin()` 读取，再注入 `lib/shared/spec-parser.ts`、`weight-format.ts` 的纯函数。
- `DEFAULT_JIN_PER_UNIT` 与 500g/斤只是「调用方未注入」时的兜底，**不要**在业务代码里硬编码换算。

## 份量（2026-11-24 档案口径）

唯一真源：份量档案表 `portion_profiles`（设置模块「份量」，迁移 20261123083624）——单人份为基本单元（`isBase` 锁定，API 拒绝编辑/停用/删除），场景份量 = 单人份 × 倍率（`multiplier` 正整数）。

- 菜品 / 净料 / 小料 / 标准化调料的 `portion` 字段统一落档案 `portion` 标签（短值）
- 服务端写校验：`lib/server/portion-profile-utils.ts` 的 `validatePortionForCreate`（启用行）/ `validatePortionForUpdate`（任意状态行 ∪ 现值）
- 客户端选项：`lib/client/use-portion-profiles.ts` 的 `usePortionProfiles` hook（模块级 60s 缓存）→ `toPortionOption` 映射；接口失败降级 `LEGACY_PORTION_OPTIONS` 兜底展示，不写回
- 转化倍率 = 目标行 `multiplier` ÷ 源行 `multiplier`（`portionScaleFactor(source, target, profiles)`，profiles 必填）；旧 `bowlEquivalent`（社区 2N）口径作废，历史数据不做兼容
- 菜品库分组：`getDishPortionGroup`（单人份/小碗菜→single、小碗菜·10份→canteen、其余→community）
- 渲染组件：`PortionTag`（`app/components/ui/portion-tag.tsx`），色板按档案场景映射，未知场景 muted 兜底

**枚举字典契约**：跨模块使用的枚举必须落在 `lib/shared/`，并同时提供「枚举值数组 + 选项元数据 + 取值解析 + 合法性判断 + 渲染组件」五件套；服务端 zod enum 与前端选项从同一份导入，不得各写一份字面量。渲染组件放 `app/components/ui/`（份量用 `PortionTag`）。详见 `docs/system-iteration-foundation-v1.md` C1。份量是**档案驱动**的反例参照：选项来自数据库，五件套中的「枚举值数组」由档案行承担，不再硬编码。

**存量迁移口径**：迁移 `20261124100000` 已把基本单元标签「小碗菜」改为「单人份」并迁移 Dish/NetIngredient 存量值；历史快照字符串由 `LEGACY_PORTION_OPTIONS` / `parsePortionCount` 兜底展示。

**当前边界（重要）**：`NetIngredient.portion` 目前只用于展示与菜品转化倍率；生产计划、库存、出库的「份数」仍由 `quantity ÷ packageSpec` 推导。两者尚未打通，属于待产品决策项 —— 实现时**不要**擅自用 `portion` 替代 `packageSpec` 参与计算。

## 净菜库存

- `PreppedStock` 双单位：`currentPortions`（份，主）+ `currentQty`（克，辅）。
- 流水 `PreppedStockLedger` 不可篡改，类型 `stock_in` / `stock_out` / `stock_rollback`。
- 出库扣减必须条件更新（`currentPortions >= n`），影响行数为 0 时抛错，防止并发超发。
- 作废 = 反向流水，绝不删除原记录。
- 缺 `packageSpec` 会导致：完成生产整单回滚、出库金额 0、标签张数 0、标准规格价显示「—」。

## 修改这些公式时

1. 只改唯一真源，不在调用方另写一份。
2. 同步补 `lib/server/__tests__/` 或 `lib/shared/__tests__/` 的单测。
3. 检查所有调用方是否需要同步展示口径（列表、详情、打印、CSV）。
