# 2026-06-22 生抽分类迁移

## 背景

原料清单中第 83 条数据为"生抽"，业务上应归属调料清单。由于系统已完成 `Ingredient` 与 `SeasoningIngredient` 表的合并，调料即为 `Ingredient` 表中二级分类属于调味品体系的记录，因此迁移只需修改其 `l2_code`。

## 迁移脚本

- `prisma/scripts/migrate-soy-sauce-to-seasoning.js`

## 执行命令

```bash
node prisma/scripts/migrate-soy-sauce-to-seasoning.js
```

脚本依赖 `DATABASE_URL` 环境变量，会自动读取项目根目录的 `.env` 文件。

## 变更内容

| 字段 | 旧值 | 新值 |
|------|------|------|
| `ingredients.id` | `83` | 不变 |
| `ingredients.l2_code` | 原原料分类 | `SEA-NET`（调料） |

## 影响范围

- `Inventory` / `InventoryLedger`：当前 Schema 已合并为单一 `ingredient_id` 外键，无需调整。
- `PurchaseReceiptItem` / `PurchasePlan`：历史记录的 `l2_code` / `l2_name` 为快照字段，保留原值以维持单据历史一致性；未结算单据如需同步可在后续操作中手动更新。

## 验证

执行后可在调料清单页面搜索"生抽"，确认其出现在调料列表中。
