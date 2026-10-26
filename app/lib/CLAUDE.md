# 客户端工具（app/lib）

本目录存放仅在浏览器端运行的通用工具与业务算法。服务端工具请见项目根目录下的 `lib/`。

## 目录职责

| 文件 | 用途 |
|------|------|
| `schedule-utils.ts` | **核心业务算法**：根据排程菜品清单生成切配工单与采购计划 |
| `csv.ts` | CSV 解析、构建、下载 |
| `api.ts` | 客户端 API 响应解析兼容层 |
| `use-pagination.ts` | 通用分页状态 Hook |

## schedule-utils.ts

这是整个系统最关键的业务算法文件之一，在排程创建/修改时被 `app/api/schedules/route.ts` 和 `app/api/schedules/[id]/route.ts` 调用。

### `buildCuttingOrders(prisma, scheduleId, items)`

根据排程中的菜品清单，汇总需要切配的净料与小料。

输入：

```ts
interface ScheduleItemInput {
  dishId: number;
  quantity: number;
}
```

处理逻辑：

1. 查询所有菜品的主料/辅料 BOM（`DishNetDetail`）和小料 BOM（`DishMinorDetail`）
2. 按 `净料/小料 ID` 汇总需求量：`amountG * quantity`
3. 查询 `IngredientCategoryL1/L2` 补充分类名称
4. 输出 `CuttingOrder` 创建数据数组，`sourceType` 为 `"net"` 或 `"minor"`

### `buildPurchasePlans(prisma, scheduleId, items, seasoningL2Codes)`

根据排程菜品清单，汇总四类采购需求并扣除当前库存。

汇总对象：

- **原料** — 主料/辅料通过 `NetIngredient.sourceIngredient` 反推出成率计算毛需求
- **小料** — 直接使用 `DishMinorDetail`
- **调料** — `DishSeasoningDetail`，需匹配 `seasoningL2Codes`
- **酱料** — `DishSauceDetail`

核心公式：

```
净料需求(g) = amountG * quantity
原料毛需求(g) = 净料需求 / yieldRate   (yieldRate > 0 时)
建议采购量 = max(0, 毛需求 - 当前库存)
```

库存扣除仅针对 `sourceType === "ingredient"` 的原料，其他类型 `stockDeducted = 0`。

### 重量展示辅助

- `formatWeight(g)` — `≥500g` 显示为斤，否则显示克
- `toWeightValue(g)` — 同上，返回 `{ value, unit }` 对象

## csv.ts

提供符合 RFC 4180 的轻量 CSV 处理：

- `parseCSV(text)` — 解析 CSV 文本，支持 `"` 转义和 BOM 头
- `buildCSV(rows)` — 将二维数组转为 CSV 字符串
- `downloadCSV(filename, rows)` — 浏览器下载 CSV，带 UTF-8 BOM

主要使用方：`/api/ingredients/import` 的原料批量导入。

## api.ts

兼容后端不同历史阶段返回格式的解析层：

- `parseList<T>(res)` — 解析列表响应，兼容裸数组、`{ data: array }`、`{ data: { items, ...pagination } }`、`{ success: true, data: ... }`
- `parseObject<T>(res)` — 解析对象响应
- `parseResponse<T>(res)` — 返回标准 `{ success, data } | { success: false, error }` 结构

## use-pagination.ts

通用分页 Hook，返回 `{ page, pageSize, setPage, setPageSize, reset }`，默认 `pageSize: 10`。

## 修改注意事项

- `schedule-utils.ts` 中的库存扣除逻辑直接影响采购计划建议量，修改前请确认业务规则。
- 所有数值计算保留 4 位小数（成本）或 2 位小数（数量），与服务端 `Decimal(10, 2/4)` 保持一致。
- 该目录文件仅在 `"use client"` 组件或客户端 hook 中引用，禁止在服务端组件/API 路由中直接 import（`schedule-utils.ts` 通过 Prisma 事务调用除外）。
