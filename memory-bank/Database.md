# 精益厨房 V3 — 数据库设计

> 数据是所有业务功能的基础。每个字段都有它存在的理由。

---

## 总表清单（23张）

| 分组 | 表名 | 说明 | 状态 |
|------|------|------|------|
| **基础字典** | `dish_categories` | 菜品类别 | ✅ |
| | `ingredient_categories_l1` | 食材一级分类 | ✅ |
| | `ingredient_categories_l2` | 食材二级分类 | ✅ |
| | `units` | 单位字典 | ✅ |
| | `suppliers` | 供应商 | ✅ |
| **食材库** | `ingredients` | 原料表 | ✅ |
| | `net_ingredients` | 净料表 | ✅ |
| | `minor_ingredients` | 小料表 | ✅ |
| | `seasoning_ingredients` | 调料表 | ✅ |
| | `sauce_ingredients` | 酱料表 | ✅ |
| **菜品档案** | `dishes` | 菜品主表 | ✅ |
| | `dish_net_details` | 菜品净料明细（主料+辅料） | ✅ |
| | `dish_seasoning_details` | 菜品小料调料明细 | ✅ |
| | `dish_sauce_details` | 菜品酱料明细 | ✅ |
| | `dish_processes` | 加工流程 | ✅ |
| **排程** | `schedules` | 排程主表 | ✅ |
| | `schedule_items` | 排程明细 | ✅ |
| | `purchase_plans` | 采购计划表 | ✅ |
| | `cutting_orders` | 切配工单 | ✅ |
| **采购库存** | `purchase_receipts` | 采购入库单主表 | ✅ |
| | `purchase_receipt_items` | 采购入库单明细 | ✅ |
| | `inventory` | 库存表 | ✅ |
| | `inventory_ledger` | 库存台账 | ✅ |

---

## 一、基础字典

### 1.1 `dish_categories` — 菜品类别

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | 自增序号 |
| code | varchar(20) UNIQUE | 编号，如 PORK、BEEF |
| name | varchar(50) | 名称，如 猪肉类、牛肉类 |
| description | text | 说明 |

数据：19条（PORK/BEEF/MUTTON/CHICKEN/DUCK/EGG/PERCH/GRASS/CRUCIAN/WUCHANG/BLACK/HAIRTAIL/YELLOW/SHRIMP/SPECIAL/TOFU/MUSHROOM/VEGETABLE/SOUP）

---

### 1.2 `ingredient_categories_l1` — 食材一级分类

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 如 VEG、MEA |
| name | varchar(50) | 如 蔬菜、畜肉 |

数据：8条（VEG蔬菜 / MEA畜肉 / POU禽蛋 / AQU水产 / DRY干货 / BEA豆制品 / PRC加工制品 / GRA米面粮油）

---

### 1.3 `ingredient_categories_l2` — 食材二级分类

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 如 VEG-LEF |
| name | varchar(50) | 如 叶菜 |
| parent_code | varchar(20) | 关联 l1.code |
| description | text | 说明 |

数据：40条，逐条导入现有 JSON。

---

### 1.4 `units` — 单位字典

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| name | varchar(20) UNIQUE | 如 斤、克、个、包、瓶 |
| category | varchar(20) | 分类：weight / volume / count |

数据示例：

| name | category |
|------|----------|
| 斤 | weight |
| 公斤 | weight |
| 克 | weight |
| 升 | volume |
| 毫升 | volume |
| 个 | count |
| 包 | count |
| 瓶 | count |
| 袋 | count |
| 箱 | count |
| 件 | count |
| 条 | count |
| 根 | count |
| 只 | count |
| 把 | count |

---

### 1.5 `suppliers` — 供应商

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| name | varchar(100) | 供应商名称 |
| contact | varchar(50) | 联系人 |
| phone | varchar(20) | 联系电话 |
| remark | text | 备注 |

---

## 二、食材库

### 2.1 `ingredients` — 原料表

食材采购入库、库存管理的基本单位。编号从 ING-0001 起。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 编号 ING-0001 |
| name | varchar(100) | 名称，如 带皮五花肉 |
| alias | varchar(100) | 常用别名 |
| l2_code | varchar(20) | 所属二级分类，关联 l2.code |
| 计量单位 | varchar(20) | 库存管理的基准单位，如 斤、瓶、个 |
| 计价单位 | varchar(20) | 采购算钱用的单位，如 斤、件、板 |
| 采购规格 | varchar(100) | 市场包装形式，如 散称、1.9L*6、30个/板 |
| 季节限定 | varchar(10) | 默认"四季"，选项：春、夏、秋、冬、四季 |
| 储存方式 | varchar(10) | 冷藏、常温、冷冻 |

---

### 2.2 `net_ingredients` — 净料表

原料经初加工后的规格化半成品。编号从 PRD-0001 起。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 编号 PRD-0001 |
| name | varchar(100) | 名称，如 去皮五花肉片 |
| source_ingredient_id | int | 关联原料 ID（由哪种原料加工而来） |
| spec | varchar(100) | 规格描述，如 0.2cm厚片 |
| yield_rate | decimal(5,2) | 出成率（%），如 85.00 |
| 净料单价 | decimal(10,2) | |
| 净料单位 | varchar(20) | 默认 500g |
| 所属二级分类 | varchar(20) | 关联 l2.code |
| 储存方式 | varchar(10) | 冷藏、常温、冷冻 |

---

### 2.3 `minor_ingredients` — 小料表

用量极小、起增香/去腥/提味作用的食材。备货制管理。编号从 SML-0001 起。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 编号 SML-0001 |
| name | varchar(100) | 名称，如 蒜末、姜片 |
| 规格形态描述 | varchar(100) | 如 切末、切片、整粒 |
| 小料单价 | decimal(10,2) | |
| 计量单位 | varchar(20) | 默认 10g |
| 产地/品牌 | varchar(100) | |
| 储存方式 | varchar(10) | 冷藏、常温、冷冻 |

---

### 2.4 `seasoning_ingredients` — 调料表

标准化产品形态的基础调味品。备货制管理。编号从 SEA-0001 起。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | serial PK | | |
| code | varchar(20) UNIQUE | 编号 | SEA-0001 |
| **name** | varchar(100) | **调料品类名称** | 生抽 |
| **brand** | varchar(100) | **品牌完整商品名** | 海天金标生抽 |
| 产品规格 | varchar(100) | | 1.9L*6 |
| 产品单位 | varchar(20) | 瓶装、袋装、桶装 | 瓶装 |
| 零售参照价 | decimal(10,2) | | 20.00 |
| 采购单价 | decimal(10,2) | | 100.00 |
| 采购单位 | varchar(20) | 件、箱、袋 | 件 |
| 储存方式 | varchar(10) | 冷藏、常温、冷冻 | 常温 |

---

### 2.5 `sauce_ingredients` — 酱料表

复合加工调味半成品，决定菜品味型方向。备货制管理。编号从 SAU-0001 起。

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| id | serial PK | | |
| code | varchar(20) UNIQUE | 编号 | SAU-0001 |
| name | varchar(100) | 酱料名称 | 豆瓣酱 |
| brand | varchar(100) | 品牌完整商品名 | 郫县豆瓣酱 |
| recipe | text | 配方说明 | 蚕豆、辣椒、盐、小麦粉 |
| 存储方式 | varchar(10) | 冷藏、常温、冷冻 | 常温 |
| 单价 | decimal(10,2) | | 15.00 |
| 计量单位 | varchar(20) | 斤、瓶、袋、桶 | 斤 |

---

## 三、菜品档案

### 3.1 `dishes` — 菜品主表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| code | varchar(20) UNIQUE | 编号 DSH-PORK-0001 |
| name | varchar(100) | 菜品名称 |
| intro | text | 菜品介绍（参照来源或做法说明） |
| category_id | int | 关联 dish_categories.id |
| cuisine | varchar(20) | 菜系做法 |
| technique | varchar(20) | 加工工艺 |
| taste | varchar(20) | 口味 |
| portion | varchar(20) | 规格份量，默认"正餐份量" |
| season | varchar(10) | 适用季节：四季/春/夏/秋/冬 |
| meat_type | varchar(10) | 荤素类型：荤菜/素菜/小荤菜 |
| cost | decimal(10,2) | 菜品成本，各食材成本加和 |
| operator | varchar(50) | 操作人 |
| created_at | timestamp | |
| updated_at | timestamp | |

**编号格式：** DSH-类别编号-流水号，如 DSH-PORK-0001

---

### 3.2 `dish_net_details` — 菜品净料明细（主料+辅料）

引用净料表。一道菜有多条记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| dish_id | int | 关联菜品 |
| role | varchar(10) | main（主料）/ support（辅料） |
| net_ing_id | int | 关联净料表 |
| amount_g | decimal(10,2) | 用量，单位g |
| spec | varchar(100) | 规格形态（从净料表带出，可调整） |
| cost | decimal(10,2) | 该食材在这道菜中的成本 |

---

### 3.3 `dish_seasoning_details` — 菜品小料调料明细

引用小料表和调料表。一道菜有多条记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| dish_id | int | 关联菜品 |
| type | varchar(10) | minor（小料）/ seasoning（调料） |
| source_id | int | 关联小料表或调料表的 ID |
| amount_g | decimal(10,2) | 用量，单位g |
| brand | varchar(100) | 品牌（从表带出，可调整） |
| cost | decimal(10,2) | 该食材在这道菜中的成本 |

---

### 3.4 `dish_sauce_details` — 菜品酱料明细

引用酱料表。一道菜有多条记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| dish_id | int | 关联菜品 |
| sauce_id | int | 关联酱料表 |
| amount_g | decimal(10,2) | 用量，单位g |
| brand | varchar(100) | 品牌（从酱料表带出，可调整） |
| cost | decimal(10,2) | 该食材在这道菜中的成本 |

---

### 3.5 `dish_processes` — 加工流程

一道菜的完整工序链。四阶段：初加工 / 预处理 / 上灶加工 / 出锅成品。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| dish_id | int | 关联菜品 |
| stage | varchar(20) | 所属阶段 |
| step_no | int | 步骤序号，排序用 |
| object | varchar(100) | 操作对象 |
| action | varchar(50) | 动作 |
| description | text | 加工过程描述 |
| tool | varchar(100) | 工具 |
| standard | text | 完成标准 |

---

## 四、排程

### 4.1 `schedules` — 排程主表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| schedule_date | date | 排程日期 |
| status | varchar(20) | 进行中 / 已完成 |
| operator | varchar(50) | 操作人 |
| created_at | timestamp | |
| updated_at | timestamp | |

### 4.2 `schedule_items` — 排程明细

一个排程包含多道菜。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| schedule_id | int | 关联排程主表 |
| dish_id | int | 关联菜品 |
| quantity | int | 份数 |

### 4.3 `purchase_plans` — 采购计划表

排程分解后自动生成。告诉采购员"建议买什么"。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| schedule_id | int | 关联排程主表 |
| ingredient_id | int | 关联原料 |
| gross_need | decimal(10,2) | 毛需求量，排程算出来的总需求 |
| stock_deducted | decimal(10,2) | 已扣库存，分解时该原料的当前库存 |
| suggested_purchase | decimal(10,2) | 建议采购量 = 毛需求量 - 已扣库存 |
| unit | varchar(20) | 单位 |
| status | varchar(20) | pending / purchased / cancelled |
| created_at | timestamp | |
| updated_at | timestamp | |

### 4.4 `cutting_orders` — 切配工单

排程分解后自动生成。告知切配师傅"今天要切什么"。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| schedule_id | int | 关联排程主表 |
| net_ing_id | int | 关联净料 |
| spec | varchar(100) | 切配规格 |
| required_qty | decimal(10,2) | 需要量 |
| unit | varchar(20) | 单位 |
| status | varchar(20) | pending / completed / cancelled |

---

## 五、采购库存

### 5.1 `purchase_receipts` — 采购入库单主表

实际采购业务的凭证。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| receipt_date | date | 入库日期 |
| supplier_id | int | 关联供应商 |
| total_amount | decimal(10,2) | 物料总金额 |
| operator | varchar(50) | 操作人 |
| image_url | text | 采购单照片 |
| created_at | timestamp | |

### 5.2 `purchase_receipt_items` — 采购入库单明细

| 字段 | 类型 | 说明 | 来源 |
|------|------|------|------|
| id | serial PK | | 系统 |
| receipt_id | int | 关联入库主表 | 系统 |
| ingredient_id | int | 关联原料 | 匹配 |
| item_name | varchar(100) | 物料名称 | 识别 |
| spec | varchar(100) | 本次采购规格 | 录入/带出 |
| qty | decimal(10,2) | 按计价单位的数量 | 录入 |
| price_unit | varchar(20) | 计价单位 | 录入 |
| unit_price | decimal(10,2) | 单价 | 录入 |
| amount | decimal(10,2) | 金额 | 自动计算 |
| stock_unit | varchar(20) | 计量单位，从原料表带出 | 自动 |
| stock_in_qty | decimal(10,2) | 入库库存量，换算后的计量单位数量 | 自动计算 |
| storage | varchar(10) | 储存方式，从原料表带出 | 自动 |

**换算逻辑：** 计价单位 ≠ 计量单位时自动换算。如生抽按件采购→库存按瓶记，系统根据原料表的采购规格换算。

### 5.3 `inventory` — 库存表

一种原料一条记录，只存当前库存量。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| ingredient_id | int | 关联原料，UNIQUE |
| current_qty | decimal(10,2) | 当前库存量 |
| unit | varchar(20) | 计量单位 |
| updated_at | timestamp | |

### 5.4 `inventory_ledger` — 库存台账

每一笔进出的流水记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial PK | |
| ingredient_id | int | 关联原料 |
| change_time | timestamp | 变动时间 |
| change_type | varchar(10) | 类型：入库 / 出库 |
| change_qty | decimal(10,2) | 数量 |
| unit | varchar(20) | 计量单位 |
| balance | decimal(10,2) | 结存，变动后剩余 |
| source | varchar(100) | 来源，如"采购入库/20260605-001" |
| operator | varchar(50) | 操作人 |
| created_at | timestamp | |

---

## 数据体系关系图

```
基础字典 ──┬── 菜品类别 ───→ 菜品主表
           ├── 食材一级分类 ─→ 食材二级分类 ─→ 原料表/净料表
           ├── 单位字典
           └── 供应商 ───→ 采购入库单

食材库 ──┬── 原料表 ───→ 采购计划/采购入库/库存
         ├── 净料表 ───→ 菜品净料明细/切配工单
         ├── 小料表 ───→ 菜品小料调料明细
         ├── 调料表 ───→ 菜品小料调料明细
         └── 酱料表 ───→ 菜品酱料明细

菜品档案 ──┬── 菜品主表 ───→ 排程明细
           ├── 菜品净料明细
           ├── 菜品小料调料明细
           ├── 菜品酱料明细
           └── 加工流程

排程 ──┬── 排程主表 ─→ 排程明细
       ├── 采购计划 ─→ 采购入库（实际执行）
       └── 切配工单 ─→ 完成自动出库

采购库存 ──┬── 采购入库单 ─→ 库存增加
           ├── 切配工单完成 ─→ 库存减少
           ├── 库存表（当前量）
           └── 库存台账（流水）
```

---

*版本：v1.2 | 2026.06.04 | 排程状态改为"进行中/已完成"；purchase_plans / purchase_receipt_items / inventory_ledger 中文字段名统一为英文；补全缺失的 created_at / updated_at*
