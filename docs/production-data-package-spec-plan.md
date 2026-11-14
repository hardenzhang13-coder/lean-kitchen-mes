# 生产数据处理方案 — 存量净料/小料「封装规格（package_spec）」补齐

> 制定日期：2026-11-14
> 适用范围：生产库 `lean_kms`（阿里云 ECS 101.37.64.216，MySQL 8.4，端口不对外暴露）
> 关联迁移：`20261112120000_add_net_packaging_fields`、`20261114090000_add_net_packagings`
> 状态：**待执行**（需在生产服务器上分阶段人工确认后执行）

---

## 0. 背景

2026-11-12 迁移为 `net_ingredients` 增加了 `package_material` / `package_size`（包装名称与尺寸快照），2026-11-14 又新增了 `net_packagings` 包装字典并把净料/小料录入改为字典下拉。

但 **`package_spec`（封装规格，单位 g）是历史遗留的空值**，存量净料/小料从未回填。它是「按份」的换算基准，一旦缺失会连锁影响四条链路。

### 0.1 影响面（已逐处核对代码）

| # | 受影响功能 | 代码位置 | 缺失时的症状 | 严重度 |
|---|---|---|---|---|
| 1 | 完成生产（净菜入库） | `app/api/production-plans/[id]/complete/route.ts`（服务端）<br>`app/components/production-plan/complete-production-dialog.tsx`（前端预检） | 抛错「`{名称}` 缺少封装规格，无法按份入库」；**该异常发生在 `prisma.$transaction` 内，整张生产计划单全部回滚**，一行缺规格即全单无法完成 | 🔴 阻断 |
| 2 | 净菜出库单金额 | `app/api/outbound-orders/route.ts`：`shippedQty = shipped × packageSpec`，`amount = 出库价 × shippedQty ÷ 500` | `packageSpec` 为空 → `shippedQty = 0` → **出库金额算成 0**，账实不符且难以察觉 | 🔴 阻断 |
| 3 | 标准规格价 | `lib/shared/net-price.ts` → `calcStandardPackagePrice` | 返回 `null` → 净料/小料清单「标准规格价」列显示「—」，成本核算缺一环 | 🟠 影响数据 |
| 4 | 切配标签打印 | `lib/shared/prep-label.ts` → `calculatePrepLabelCopies` | 标签张数算为 0 → 打印不出标签 | 🟠 影响作业 |
| 5 | 生产计划份数换算 | `lib/server/production-plan-utils.ts` | `packageSpec` 为空 → 份数无法计算，只剩克数 | 🟡 影响展示 |

### 0.2 为什么不能靠代码「兜底默认值」

`package_spec` 是**物理事实**（一个标准包装袋到底装多少克），不是业务规则。填错会直接导致库存份数、出库金额、标签张数三处一起错，而且错得「看起来正常」。

因此本方案的原则是：**人工确认物理克数 → 脚本精确回填 → 全量校验**，绝不由程序猜值。

---

## 1. 目标与非目标

### 目标
1. 生产库中**所有未删除、且被菜品 BOM 或生产链路引用**的净料/小料，`package_spec` 均为有效的正整数（克）。
2. 全过程可审计：谁在什么时候把哪条档案从多少克改成多少克。
3. 全过程可回滚：任何一步出问题，10 分钟内恢复到执行前状态。

### 非目标
- 不修改 `package_material` / `package_size`（已是快照，且已回填进 `net_packagings` 字典）。
- 不修改 `unit_price` / `yield_rate` / `gross_margin_rate` 等价格口径字段（价格口径已于 2026-11-14 统一为实时派生）。
- 不删除任何档案（僵尸档案只做标记，软删除另行决策）。
- 不做历史库存数据的追溯修正（生产库净菜库存 `prepped_stock` 自 v002 上线后才开始有数据，若已有存量则单独处理）。

---

## 2. 安全前提（执行前逐项确认）

| 前提 | 做法 | 确认方式 |
|---|---|---|
| 备份可恢复 | 额外做一次单表备份 `net_ingredients`（含本次要改的行） | `ls -l backups/lean_kms-net_ingredients-*.sql.gz.enc` |
| 加密备份密钥可用 | `BACKUP_ENCRYPTION_KEY` 已配置 | `docker compose exec -T backup env \| grep BACKUP` |
| 只读优先 | 阶段一、二全部是 `SELECT`，不写库 | 执行记录留档 |
| 幂等 | 所有 `UPDATE` 带 `WHERE package_spec IS NULL` 保护，重复执行不重复写 | 二次执行影响行数为 0 |
| 事务 | 批量更新放在单个事务内，中途失败整体回滚 | 执行日志 |
| 可追溯 | 每次更新写 `operation_logs` 一条记录 | `SELECT * FROM operation_logs WHERE entity='NetIngredient'` |
| 低峰执行 | 避开排程高峰（建议工作日 20:00 后） | 与运营确认 |

> ⚠️ 生产 MySQL 端口不对外暴露，所有 SQL 必须在服务器上执行：
> `ssh -i ~/.ssh/aliyun_deploy root@101.37.64.216` → `cd /opt/lean-kms-v3` → `docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" lean_kms'`

---

## 3. 阶段一：只读盘点

### 3.1 盘点 SQL（只读）

```sql
-- 3.1.1 总量概览
SELECT
  COUNT(*)                                             AS 全部档案,
  SUM(deleted_at IS NULL)                              AS 未删除,
  SUM(deleted_at IS NULL AND package_spec IS NULL)     AS 缺规格,
  SUM(deleted_at IS NULL AND (package_spec IS NOT NULL AND package_spec <= 0)) AS 非法规格
FROM net_ingredients;

-- 3.1.2 缺规格明细（含引用情况，决定优先级）
SELECT
  n.id, n.code, n.name,
  c1.name AS 一级分类, c2.name AS 二级分类,
  n.package_material, n.package_size, n.yield_rate, n.unit_price,
  n.source_ingredient_id,
  i.code AS 来源原料编号, i.name AS 来源原料,
  (SELECT COUNT(*) FROM dish_net_details d WHERE d.net_ingredient_id = n.id AND d.deleted_at IS NULL)  AS 菜品主辅料引用,
  (SELECT COUNT(*) FROM dish_minor_details d WHERE d.net_ingredient_id = n.id AND d.deleted_at IS NULL) AS 菜品小料引用,
  (SELECT COUNT(*) FROM prepped_stock s WHERE s.source_id = n.id AND s.source_type IN ('net','minor')) AS 有净菜库存,
  n.created_at, n.updated_at
FROM net_ingredients n
LEFT JOIN ingredient_category_l2 c2 ON c2.code = n.l2_code
LEFT JOIN ingredient_category_l1 c1 ON c1.code = c2.parent_code
LEFT JOIN ingredients i ON i.id = n.source_ingredient_id
WHERE n.deleted_at IS NULL
  AND (n.package_spec IS NULL OR n.package_spec <= 0)
ORDER BY (菜品主辅料引用 + 菜品小料引用) DESC, n.id;
```

### 3.2 关键判读

- **有 BOM 引用 + 有净菜库存** → P0，必须在下一张生产计划单完成前补齐，否则阻断主链路。
- **有 BOM 引用、无库存** → P1，本周内补齐。
- **无任何引用** → P2，结合运营判断是否为有效档案；无效的走软删除决策（不在本方案内执行）。

> ⚠️ 盘点判读时注意：`package_material` 与 `package_size` 在 schema 上有默认值（`密封袋` / `50cm×40cm`），**字段非空 ≠ 运营真的确认过包装**。不能因为它有值就认为档案是完整的。

---

## 4. 阶段二：人工确认克数

### 4.1 导出待确认清单

把 3.1.2 的结果导出为 CSV（`code` 作为唯一键）：

```sql
SELECT n.code, n.name, c2.name AS 二级分类, n.package_material, n.package_size,
       n.yield_rate AS 出成率, n.unit_price AS 净料单价,
       '' AS 待填封装规格g, '' AS 确认人, '' AS 确认日期
FROM net_ingredients n
LEFT JOIN ingredient_category_l2 c2 ON c2.code = n.l2_code
WHERE n.deleted_at IS NULL AND (n.package_spec IS NULL OR n.package_spec <= 0)
INTO OUTFILE '/tmp/net_package_spec_todo.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';
```

### 4.2 填表口径（必须给运营的明确说明）

| 场景 | 口径 |
|---|---|
| 有标准包装袋/盒 | 填**单袋实际装入的净料克数**（例如 500g 袋装青椒丝 → 500） |
| 无标准包装、按重量分装 | 填**当前实际使用的分装克数**；若分装规格不固定，先暂停该行（见第 7 节兜底） |
| 散装无包装 | 填业务约定的最小操作单元克数（例：1 斤 → 500），并在确认人栏注明「散装按斤」 |
| 出成率 > 100%（上浆挂糊类） | 克数按**成品净料重量**填，不是原料重量 |
| 拿不准 | **留空，不要猜**。留空行进入第 7 节兜底清单，由厨师长现场确认 |

> 明确禁止：由代码默认值填充、由「原料克数 ÷ 出成率」反推、或按经验批量填同一个值。

### 4.3 确认要求
- 每行必须填 **克数 + 确认人 + 确认日期**；
- 净料/小料由**厨师长**确认（现场作业口径），运营复核；
- 确认完成的 CSV 由厨师长在群里回执确认后，才进入阶段三。

---

## 5. 阶段三：执行更新

### 5.1 前置校验（必须全绿才执行）

```sql
-- 5.1.1 待更新条数必须与确认表条数一致
SELECT COUNT(*) FROM net_ingredients
WHERE deleted_at IS NULL AND (package_spec IS NULL OR package_spec <= 0);

-- 5.1.2 备份本次将修改的行（含旧值，供回滚）
SELECT id, code, name, package_spec, package_material, package_size
FROM net_ingredients
WHERE deleted_at IS NULL AND (package_spec IS NULL OR package_spec <= 0)
INTO OUTFILE '/tmp/net_package_spec_backup_20261114.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';
```

### 5.2 执行方式

**优先用应用自身的更新接口**（走 `PUT /api/net-ingredients/[id]`，自动写 `operation_logs`、自动重算价格体系）：

```
PUT /api/net-ingredients/{id}
Content-Type: application/json
Cookie: session=<管理员会话>

{ "packageSpec": 500 }
```

- 优点：有操作日志、有权限校验、有价格重算、行为与运营日常操作一致。
- 注意：接口要求 `yieldRate` 必填、`sourceIngredientId` 必填，更新时需**原值回传**，不能只传 `packageSpec`。做法：先 `GET /api/net-ingredients/{id}` 取全量字段，改 `packageSpec` 后整体回传。
- 逐条执行（一次一条），单条失败不影响其余条目，便于定位。

**若数据量大需要脚本批量**：用 SQL 事务执行，但必须逐条写 `operation_logs`：

```sql
START TRANSACTION;
UPDATE net_ingredients
SET package_spec = 500, updated_at = NOW(3)
WHERE code = 'NET-0001' AND deleted_at IS NULL AND package_spec IS NULL;
-- ... 逐条
INSERT INTO operation_logs (entity, entity_id, action, description, operator, created_at)
VALUES ('NetIngredient', <id>, 'UPDATE', '补齐封装规格：NULL → 500g', 'system:migration', NOW(3));
COMMIT;
```

### 5.3 幂等保证
所有 `UPDATE` 均带 `WHERE package_spec IS NULL`（或 `AND package_spec = <旧值>`）。重复执行影响行数为 0，不会覆盖运营后续的修改。

---

## 6. 阶段四：校验

```sql
-- 6.1 硬指标：未删除且缺规格的档案数必须为 0
SELECT COUNT(*) AS 仍缺规格
FROM net_ingredients
WHERE deleted_at IS NULL AND (package_spec IS NULL OR package_spec <= 0);

-- 6.2 非法值检查（0 或负数）
SELECT COUNT(*) AS 非法值 FROM net_ingredients
WHERE deleted_at IS NULL AND package_spec IS NOT NULL AND package_spec <= 0;

-- 6.3 与「份数」相关的存量数据是否自洽（有库存的档案必须有规格）
SELECT s.source_id, s.current_portions, s.current_qty, n.package_spec
FROM prepped_stock s JOIN net_ingredients n ON n.id = s.source_id
WHERE s.source_type IN ('net','minor') AND (n.package_spec IS NULL OR n.package_spec <= 0);

-- 6.4 标准规格价抽样核对：出库价(元/斤) × 规格g ÷ 500 应等于页面「标准规格价」
SELECT n.code, n.name, n.unit_price, n.processing_fee_per_jin, n.gross_margin_rate, n.package_spec
FROM net_ingredients n
WHERE n.deleted_at IS NULL AND n.package_spec IS NOT NULL
LIMIT 20;
```

**业务侧验证（人工，1 条即可）**：
1. 新建一张生产计划单 → 完成生产（确认份数 > 0）→ 成功净菜入库；
2. 打开 `/inventory` → 当前库存该品种的「份」与「g」是否合理；
3. 创建一张出库单 → 出库金额是否非 0 且与手工核算一致；
4. 打印一张切配标签 → 标签张数是否正确。

---

## 7. 回滚方案

| 场景 | 回滚动作 |
|---|---|
| 阶段三执行中断（事务未提交） | 事务自动回滚，无需处理 |
| 阶段三已提交但发现填错 | 用 5.1.2 的备份 CSV 按 `id` 还原 `package_spec`（原值为空即置 NULL），单条 UPDATE + 写操作日志 |
| 阶段四业务验证发现口径错误 | 同上，逐条还原；因所有更新都带 `WHERE package_spec IS NULL`，不会误改运营已修正过的档案 |
| 数据污染范围大 | 用当日加密备份整库恢复（`backups/lean_kms-YYYYMMDD_HHMMSS.sql.gz.enc`），恢复前先确认该备份时间点之后没有其他业务写入 |

**回滚窗口**：建议在执行后 **7 天内**保留备份 CSV 与数据库备份，过期后再清理。

---

## 8. 兜底与防复发

### 8.1 执行期的兜底（个别档案确实无法确定克数）
- 该行在生产计划单中**标记为「暂不确认」**（hold），不标记「完成」，可分批提交；
- 登记到《待确认克数台账》，指定责任人与截止日期；
- 明确规则：hold 行不阻断其余行的入库（当前事务模型下 hold 行不抛错，可正常提交）。

> ⚠️ 风险提示：若某行被标记「完成」但 `packageSpec` 缺失，**整单事务回滚**。所以在补齐完成前，涉及该品种的生产计划单只能走 hold。

### 8.2 防复发（应用层已具备 + 建议补充）
| 层级 | 状态 |
|---|---|
| 表单层 | ✅ 已具备：净料/小料录入与编辑时 `packageSpec` 必填且必须为正整数 |
| API 层 | ✅ 已具备：`POST/PUT /api/net-ingredients` 校验 `packageSpec` 必填 |
| 数据库层 | ⬜ 建议（本期不做）：`package_spec` 无 NOT NULL 约束，绕过应用直写仍可写入 NULL。后续可在确认业务无「暂缺」场景后加约束或加定期巡检 |
| 巡检层 | ⬜ 建议（本期不做）：新增只读巡检脚本，每次部署后检查「未删除且缺规格档案数 > 0」并告警。脚本可参考 `scripts/audit-schedule.ts` 现有写法 |

---

## 9. 执行清单（勾选式）

- [ ] 0. 与运营确认执行窗口（工作日 20:00 后，避开排程高峰）
- [ ] 1. 确认服务器可 SSH，`docker compose ps` 全绿
- [ ] 2. 触发一次加密备份，记录文件名
- [ ] 3. 阶段一：执行 3.1 盘点 SQL，保存结果
- [ ] 4. 判定 P0/P1/P2 优先级
- [ ] 5. 阶段二：导出 CSV → 厨师长填克数 → 群内回执确认
- [ ] 6. 阶段三：执行 5.1 校验 → 逐条更新 → 记录操作日志
- [ ] 7. 阶段四：执行 6.1–6.4 校验 SQL
- [ ] 8. 业务验证：完成生产 → 净菜入库 → 出库单金额 → 标签打印
- [ ] 9. 留存 `/tmp/net_package_spec_backup_*.csv` 与操作日志，保留 7 天
- [ ] 10. 关闭台账中剩余的 hold 项

---

## 10. 时间预估

| 阶段 | 预估耗时 | 责任方 |
|---|---|---|
| 阶段一 盘点 | 0.5 小时 | 开发（执行 SQL） |
| 阶段二 人工确认 | 1–3 天（取决于待补条数） | 厨师长 + 运营 |
| 阶段三 更新 | 1–2 小时（按条数） | 开发 |
| 阶段四 校验 | 1 小时 | 开发 + 运营 |
| 合计 | 3–5 个工作日 | — |

---

*创建于 2026-11-14 | 与 `docs/interaction-visual-baseline-v1-rollout-plan.md` 配套*
