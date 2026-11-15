---
name: module-iteration
description: 新建或改造一个业务模块（主数据 CRUD 清单页、详情、表单、API）时使用。按统一施工顺序落地列表页、详情抽屉、复制、连续录入与 API 契约，避免每个模块各发明一套形态，并给出可验证的交付口径。
---

# 模块迭代：主数据模块施工顺序

适用：设置（单位/门店/供应商/用户/分类/包装）、库存（当前库存/出库单/台账）、排程、生产计划、菜品、采购等模块的**新建或改造**。

契约正本：`docs/system-iteration-foundation-v1.md`；视觉交互：`docs/interaction-visual-baseline-v1.md`。

## 施工顺序

按此顺序做，缺一步就会在下一个模块里重新踩坑。

### 1. 先对齐口径，再写界面

- 涉及枚举（状态、分类、档位、口径）的，先确定枚举字典落点：`lib/shared/<domain>.ts`，五件套齐全（枚举值数组 / 选项元数据 / 取值解析 / 合法性判断 / 渲染组件）。
- 服务端 zod schema 与前端选项从同一份导入。
- 涉及价格、单位、份量的，先读 `.agents/skills/domain-pricing`。

**不做的后果**：口径散在业务目录里，下个模块抄一份，两边慢慢漂移。

### 2. 列表页（契约 C2）

骨架只有四段：`PageHeader` → `ListToolbar` → `DataTable` → `Pagination`。

- 字段标题不带单位，单位由数值行表达。
- 表头加粗，字段单行完整显示，不截断。
- 点击整行进详情，操作列不重复放「查看」。
- 操作列直接放全部业务动作图标，不折叠进「更多」。
- 删除收敛到详情页，列表操作列不放删除。
- 主数据清单底部加 `totalLabel`（数据区间汇总）+ `showPageSize`。
- 改筛选条件时页码归 1。

**不做的后果**：自建 `<Table>` 带来各不相同的加载态、空态、密度与横向滚动行为。

### 3. 详情抽屉（契约 C3）

- `RecordSheet`（50vw）+ `RecordActions`（destructive / secondary / primary 三槽）。
- 内容用 `DetailSection` 分组，组内 `InfoCell` 双列信息单元。
- 加载失败说明原因并给下一步。
- 只读 ↔ 编辑切换，dirty 时关闭走 `useRecordGuard` + `DiscardChangesDialog`。

### 4. 复制（契约 C4）

- 复制 = 新建动作，回填全部字段，名称追加「-副本」。
- 详情页触发的复制弹窗叠在抽屉之上，提交成功后关闭全部弹窗。
- 编排走 `useRecordCopy`，不要自己写 `buildCopyData`。

### 5. 连续录入（契约 C5）

- 需要批量录入时提供「保存并继续添加」。
- 字段策略配在 `useRecordForm` 的 `clearOnContinue` / `keepOnContinue`。
- 保留分类、单位；清空名称、价格等每条重填的字段。

### 6. API 契约

- 列表 GET 分页（`page` / `pageSize`），响应走 `paginated`。
- 请求体走 `validateBody` + `lib/server/schemas/<domain>.ts`。
- 写操作走 `logOperation`。
- 权限在 `lib/shared/access-control.ts` 的 `canAccessApi` 登记 —— **未登记的 API 默认仅管理员可访问**，不登记等于功能对运维不可见。
- 详见 `.agents/skills/api-endpoint`。

### 7. 样张与验收

- 新增或改版通用件，同步 `/ui-kit` 可视样张。
- 三档桌面宽度（1280 / 1440 / 1920）实机走一遍主路径。
- 门禁见 `.agents/skills/verify-change`。

## 反模式

| 反模式 | 正确做法 |
|---|---|
| 业务目录里另写一份枚举选项数组 | 提到 `lib/shared/` 并补齐五件套 |
| `DialogContent` 直接写 `sm:max-w-[560px]` | `AppDialogContent size="form"` |
| 自建 `<Table>` 而不用 `DataTable` | 统一用 `DataTable` |
| 复制时带着原记录 id 提交 | 复制按新建提交 |
| 表单里维护 `continueAddingRef` 标志位 | 策略配在 `useRecordForm` |
| `window.confirm` 做删除确认 | `AppDialogContent size="compact"` |
| 新增 API 不登记权限 | 在 `canAccessApi` 显式登记 |
| 列表页只做一半就交付 | 按上面的顺序一次做完，避免留下半成品形态 |

## 不做的事

- 不为一次改造新造通用组件：先复用 `app/components/ui/` 现有件；确实需要新通用件时，同时更新 `docs/system-iteration-foundation-v1.md` §3.2 唯一入口表与 `/ui-kit` 样张。
- 不做一次性全站重写：按 `docs/system-iteration-foundation-v1.md` §5 的批次顺序推进。
