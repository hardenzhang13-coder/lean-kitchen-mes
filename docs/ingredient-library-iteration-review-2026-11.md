# 食材库迭代总结（2026-11）

> 来源提交：`c49d17a` feat(ingredients): 份量体系、档案复制与食材清单交互迭代
> 背景：试运行第一周现场反馈，先在食材库落地
> 定位：本文是「全系统迭代升级基础」的经验来源；通用契约见 [`docs/system-iteration-foundation-v1.md`](./system-iteration-foundation-v1.md)

---

## 1. 这一轮做了什么

6 件事，全部落在食材库（原料 / 净料 / 小料 / 调料 / 酱料 5 个清单）。

### 1.1 份量枚举统一

**问题**：净料/小料档案与菜品档案各写一套份量口径，建档时容易填错；菜品转化倍率靠人记。

**做法**：

- 枚举收敛为一份：`小碗菜` / `小碗菜·10份` / `社区·2份` / `社区·3份` / `社区·4份`。
- 唯一真源 `lib/shared/portion-scale.ts`，前后端共用：服务端 zod enum、前端下拉选项、标签渲染、倍率换算全部从这一份导入。
- 每个枚举值带一个 `bowlEquivalent`（小碗菜等价份数 1 / 10 / 4 / 6 / 8），**换算只认这个系数**，不做字符串反推。
- 落库存短值（「社区·2份」），说明文案只在前端展示，不进数据库。
- 新建必填，存量可空（存量 77 条净料 `portion` 全为 NULL，符合设计）。

**落点**：`lib/shared/portion-scale.ts`、`lib/server/schemas/net-ingredient.ts`、`lib/server/schemas/dish.ts`、`app/api/dishes/[id]/scale/route.ts`、`app/components/ui/portion-tag.tsx`。

### 1.2 存量口径迁移

- 迁移 `20261115100000_add_portion_to_net_ingredients`：加 `net_ingredients.portion` 列 + 两条显式 `UPDATE dishes`，把「单人份」映射为「小碗菜」、「一锅10份」映射为「小碗菜·10份」。
- 代码侧保留 `LEGACY_PORTION_COUNTS`（单人份 = 1、一锅10份 = 10），旧值仍能解析，不静默变成 `null`。
- 迁移前生产盘点确认 `dishes.portion` 只有「单人份 ×3 / 一锅10份 ×1」，全部落在映射表覆盖范围内。

### 1.3 五个清单统一收口

五个清单页统一为 `PageHeader → ListToolbar → DataTable → Pagination`：

- 底部统一「第 X-Y 条，共 N 条 X」数据区间汇总 + 每页条数选择。
- 字段标题不带单位，单位由数值行表达（`净料单价` → `¥3.56/斤`）。
- 表头加粗，字段单行完整显示，不截断。
- 点击整行进详情，操作列不重复放「查看」。
- 操作列直接展示全部业务动作图标，不折叠进「更多」菜单。

### 1.4 档案复制

- 复制是**新建动作**：以现有档案回填全部字段，名称追加「-副本」绕开重名校验，原档案不受影响。
- 从详情页触发时，复制表单以新弹窗叠在详情抽屉之上；提交成功后关闭全部弹窗。

### 1.5 删除入口收敛

- 删除只保留在详情页（酱料在编辑弹窗底部），列表操作列只留复制与编辑。
- 理由：删除是低频高风险动作，不该和复制、编辑并列在高频扫读的列表里。

### 1.6 保存并继续添加

- 原料清单支持连续录入：保存后保留分类与单位，清空名称、品牌、价格、供应商，弹窗保持打开并提示「已保存，可继续添加下一条」。

---

## 2. 这一轮沉淀出的通用件

| 通用件 | 位置 | 原本在哪 |
|---|---|---|
| `PortionTag` 份量标签 | `app/components/ui/portion-tag.tsx` | `app/components/ingredients/portion-tag.tsx`（被 dish-form 跨目录引用） |
| `DetailSection` / `InfoCell` 详情双列信息单元 | `app/components/ui/detail-section.tsx` | `ingredient-detail-sheet.tsx` 内部局部组件 |
| `useRecordGuard` + `DiscardChangesDialog` 未保存改动拦截 | `app/components/ui/` | `ingredient-detail-sheet.tsx` 内联逻辑 |
| `useRecordCopy` 复制编排 | `lib/client/use-record-copy.ts` | 四个清单页各写一遍 `buildCopyData` |
| `useRecordForm` 连续录入字段策略 | `app/components/ui/use-record-form.ts` | `useIngredientForm` 内的 `continueAddingRef` 标志位 |
| `PORTION_OPTION_BY_VALUE` 枚举索引 | `lib/shared/portion-scale.ts` | 各模块重复建 Map |

---

## 3. 通用化抽取出的六条契约

详见 [`docs/system-iteration-foundation-v1.md`](./system-iteration-foundation-v1.md) §2。

| 编号 | 契约 | 来源 |
|---|---|---|
| C1 | 枚举字典契约 | 1.1 + 1.2 |
| C2 | 列表页契约 | 1.3 |
| C3 | 详情抽屉契约 | 1.5 + 详情抽屉的未保存拦截 |
| C4 | 档案复制契约 | 1.4 |
| C5 | 连续录入契约 | 1.6 |
| C6 | 存量口径迁移套路 | 1.2 |

---

## 4. 这一轮踩过的坑

### 4.1 通用层自己违反基线

`app/components/ui/` 里的 `select-dialog.tsx` / `import-dialog.tsx` / `select-table-mode.tsx` 三个组件直写弹窗像素宽度。**通用层是所有模块的来源，通用层违规等于把违规复制给每个使用者。** 本轮已改为 `AppDialogContent` 语义尺寸，并给 `SelectDialog` 加 `size` 属性。

### 4.2 跨业务域直接引用业务目录

`app/components/dish-form/bom-picker-dialog.tsx` 直接 import `app/components/ingredients/portion-tag.tsx`。这是「份量是跨域概念」的信号 —— 凡是跨域复用的组件，就不该放在某个业务目录里。本轮已把 `PortionTag` 提升到 `app/components/ui/`。

### 4.3 文档与代码漂移

基线文档把列表页规则写在「6.2.1 食材清单」专节里，导致规则看起来是食材专属的，其它模块改造时没有约束可依。本轮把食材专有条款收窄到一节，其余升格为通用契约章节。

---

## 5. 验证结论

| 项目 | 结果 |
|---|---|
| `npx tsc --noEmit` | 0 错误 |
| `npm run build` | 通过 |
| `npm run lint` | 0 error；告警从 62 降至 21，剩余集中在 `app/ingredients/**`(9) 与 `app/settings/**`(12) |
| `npm test` | 28 套件 / 158 用例全绿（含新增 `portion-scale` 与表单连续录入用例） |
| Prisma 零差异 | `migrate diff` 输出为空迁移 |
| 迁移后生产核对 | `dishes.portion` 小碗菜 ×3、小碗菜·10份 ×1，与迁移映射一致；`net_ingredients.portion` 列存在，77 条存量均为 NULL；14 张关键表行数与部署前完全一致 |
| 浏览器实测 | 5 个清单的筛选、分页汇总、复制、编辑、删除入口、保存并继续添加逐项走通 |

---

## 6. 这一轮之后还欠什么

1. **设置模块尚未收口**：7 个页面仍是自建 `<Table>` 与像素宽度弹窗，12 条 lint 告警待清。定为下一批（B1）。
2. **库存 / 排程 / 生产计划 / 菜品**的列表与详情仍是各自实现，契约已就位，尚未落地。
3. **采购模块锁定**（`TRIAL_FEATURES.purchases = false`），链路未在生产验证，不能排在前面。

---

*创建于 2026-11-15 | 配套 [`docs/system-iteration-foundation-v1.md`](./system-iteration-foundation-v1.md)*
