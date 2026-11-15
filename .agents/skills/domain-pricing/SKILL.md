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
```

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

## 菜品成本（实时，不信任快照）

`lib/server/dish-costing.ts` 的 `getCurrentDishCostMap(dishIds)`：

- 净料/小料按出库价，调料按每斤单价，酱料按配方成本 + 毛利率。
- `Dish.cost` 是历史快照，只作兜底，不作为展示依据。
- 菜品列表、菜品详情、排程详情都应走这个函数。

## 单位换算（唯一来源是字典）

- 字典表 `units` 的 `gramsPerUnit` 是唯一换算依据。
- 服务端通过 `lib/server/unit-factors.ts` 的 `getJinFactors()` / `getGramFactors()` / `getGramsPerJin()` 读取，再注入 `lib/shared/spec-parser.ts`、`weight-format.ts` 的纯函数。
- `DEFAULT_JIN_PER_UNIT` 与 500g/斤只是「调用方未注入」时的兜底，**不要**在业务代码里硬编码换算。

## 份量（2026-11 新口径）

`lib/shared/portion-scale.ts` 是唯一真源：

- 枚举：小碗菜 / 小碗菜·10份 / 社区·2份 / 社区·3份 / 社区·4份
- 小碗菜等价份数（`bowlEquivalent`）：1 / 10 / 4 / 6 / 8
- 菜品转化倍率 = 目标等价份数 ÷ 源等价份数（`portionScaleFactor`）
- 净料、小料、菜品共用同一套枚举
- 落库存短值（如「社区·2份」），描述文案只在前端展示，不进数据库

**枚举字典契约**：跨模块使用的枚举必须落在 `lib/shared/`，并同时提供「枚举值数组 + 选项元数据 + 取值解析 + 合法性判断 + 渲染组件」五件套；服务端 zod enum 与前端选项从同一份导入，不得各写一份字面量。渲染组件放 `app/components/ui/`（份量用 `PortionTag`）。详见 `docs/system-iteration-foundation-v1.md` C1。

**枚举重构时**：存量迁移必须写显式 UPDATE 映射表（不用 `LIKE` 之类的模糊条件），迁移前用只读查询确认存量取值集合全部落在映射表内；代码侧保留旧值解析兼容（`LEGACY_PORTION_COUNTS`），旧数据不得静默变成 `null`。

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
