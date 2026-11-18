# 净料/小料标准规格与菜品 BOM 实时联动

## 业务规则

净料和小料的每一条档案，就是某个菜品 BOM 的标准规格。菜品 BOM 中净料/小料的单份用量必须始终等于对应 `NetIngredient.package_spec`，不存在按用量计算的独立口径。

- 唯一真源：`NetIngredient.packageSpec`
- `DishNetDetail.amountG` / `DishMinorDetail.amountG`：冗余缓存，由服务端写入，必须等于 `packageSpec`
- 调料本期未纳入；`Ingredient` 目前没有 `packageSpec`

## 运行时行为

修改净料/小料规格（`PUT /api/net-ingredients/[id]`）时，在同一事务内：

1. 更新净料/小料档案；
2. 同步所有引用它的菜品 BOM 行：`amountG = packageSpec`，按当前出库价重算行成本；
3. 重算受影响菜品的 `Dish.cost`；
4. 重建引用这些菜品的**待生效/进行中**排程的切配工单与采购计划；
5. 重建引用上述排程、或引用相关内部生产单的**待生效/进行中**生产计划三份 JSON 快照；
6. 写操作日志（旧/新规格、联动 BOM 行数、影响菜品/排程/计划数）。

触发条件：`packageSpec`、`yieldRate`、`sourceIngredientId` 任一变化。仅价格类字段变化时只重算成本，不重建单据。

进度护栏：只要排程已有切配/采购/出库/销售回录进度，或生产计划已有确认态/实际份数，整个事务回滚并返回 409，不覆盖实际数据。

不重算：已完成排程/生产计划、出库单、库存流水、`PreppedStock`。

## 读取链路

- 排程/采购：`lib/server/schedule-utils.ts` 使用 `resolveNetBomAmountG(packageSpec, amountG)`
- 成本：`lib/server/dish-costing.ts` 同上
- 菜品详情：`GET /api/dishes/[id]` 返回的 `amountG` 已归一为当前 `packageSpec`
- 菜品表单：`dishToBom()` 优先使用 `packageSpec`

## 一次性对齐脚本

用于修正代码上线前已存在的 BOM 缓存漂移，并重建未完成单据。

```bash
# 预览（默认不写库）
node --env-file=.env --import tsx scripts/align-dish-bom-package-spec.ts

# 执行（先做相关表定向备份）
node --env-file=.env --import tsx scripts/align-dish-bom-package-spec.ts --apply \
  --audit-out scripts/out/dish-bom-align.json
```

脚本会输出每行旧用量 → 新规格，`--apply` 前写入审计 JSON（含 BOM 行、菜品成本、受影响排程切配/采购、生产计划旧快照），可用于人工回滚或核对。

建议备份表：`dish_net_details`、`dish_minor_details`、`dishes`、`cutting_orders`、`purchase_plans`、`production_plans`。

## 校验 SQL

```sql
-- 应为 0
SELECT COUNT(*) FROM dish_net_details d
JOIN net_ingredients n ON n.id = d.net_ing_id
WHERE n.package_spec IS NOT NULL AND d.amount_g <> n.package_spec;

SELECT COUNT(*) FROM dish_minor_details d
JOIN net_ingredients n ON n.id = d.net_ing_id
WHERE n.package_spec IS NOT NULL AND d.amount_g <> n.package_spec;

-- 未完成排程的切配量必须是封装规格的整数倍
SELECT c.id, c.item_name, c.required_qty, n.package_spec
FROM cutting_orders c
JOIN schedules s ON s.id = c.schedule_id
JOIN net_ingredients n ON n.id = c.source_id
WHERE s.status IN ('待生效', '进行中')
  AND n.package_spec > 0
  AND MOD(c.required_qty, n.package_spec) <> 0;
```
