<!-- BEGIN:nextjs-agent-rules -->
# 工作区指令：精益厨房 V3

> 此文件为 Kimi Work / Daimon 的工作区指令，影响当前工作区所有 Agent 会话。

## 1. 安全红线（绝对禁止）

- ❌ 禁止将 `.env` 文件提交到版本控制
- ❌ 禁止在 API 中直接透传请求体到 Prisma（必须先校验）
- ❌ 禁止在事务中使用 `as any` 绕过类型检查
- ❌ 禁止删除已结算采购单相关的库存台账记录（作废≠删除，只能回滚）
- ❌ 禁止新增任何 `any` 类型（现有代码逐步消除）
- ❌ 禁止新增无分页的列表 API

## 2. 代码提交前强制检查

每次修改代码后，必须按以下顺序执行：

```bash
# 1. TypeScript 编译检查
npx tsc --noEmit

# 2. 构建检查
npm run build

# 3. ESLint 检查
npm run lint
```

**以上任一步骤失败，不得提交代码。**

## 3. 项目结构约定

- `app/` → Next.js App Router 页面和 API
- `app/components/` → 共享客户端组件（复用 2 次以上的组件）
- `components/ui/` → shadcn/ui 组件（只通过 CLI 管理，不手动修改）
- `lib/` → 服务端工具（prisma、auth、session、ai）
- `app/lib/` → 客户端工具（csv、schedule-utils、分页等）

### 新 API 的必选清单

- [ ] 输入校验（zod 或手动校验）
- [ ] 操作日志（`logOperation`）
- [ ] 错误处理（返回 `{ code, data?, message? }` 格式）
- [ ] 类型安全（无 `any`）
- [ ] 分页（列表 API）
- [ ] 权限检查（如需要）

## 4. 数据库操作规范

- Schema 变更必须通过 `prisma migrate dev` 生成迁移文件，**禁止直接 `db push` 到生产**
- 涉及库存更新的操作必须放在 `prisma.$transaction` 中
- 并发场景（采购单作废/编辑）必须加乐观锁或序列化事务
- 所有表必须考虑软删除（新增 `deletedAt` 字段）
- 删除操作前必须检查引用关系，防止外键约束失败

## 5. AI 接口使用规范

- AI 识别（Qwen）调用必须包裹 try-catch，失败时提供手动录入 fallback
- AI 接口必须限流（每分钟 ≤ 10 次）
- 生产环境必须配置 `QWEN_API_KEY` 和 `QWEN_BASE_URL`，缺失时应用拒绝启动
- 图片存储使用 Cloudinary，必须配置 `CLOUDINARY_CLOUD_NAME` 和 `CLOUDINARY_UPLOAD_PRESET`
- 供应商自动创建必须经过人工确认，不可直接入库

## 6. Next.js 版本警告

⚠️ **This is NOT the Next.js you know.**

This version (16.2.7 + React 19.2.4) has breaking changes — APIs, conventions, and file structure may all differ from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## 7. 紧急联系（上下文丢失时）

如果当前会话丢失了项目上下文，优先读取以下文件恢复：
1. `memory-bank/Product.md` — 产品定义
2. `memory-bank/Database.md` — 数据模型
3. `memory-bank/progress.md` — 最新推进状态
4. `memory-bank/Router.md` — 页面路由

## 8. 用户画像

- 用户：张浩浩（产品经理背景）
- 沟通语言：简体中文 + 技术术语混用
- 协作偏好：直接执行方案，不喜欢只给操作指引
- 决策权限：所有代码修改和文件写入必须经过确认

<!-- END:nextjs-agent-rules -->
