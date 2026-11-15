# 项目 Skills

本目录为**项目级 Skill 正本**，随仓库提交，供所有 Agent 共用（Claude Code / Codex / Kimi 等）。

## 目录约定

- 正本：`.agents/skills/<name>/SKILL.md`
- Claude Code 发现入口：`.claude/skills/<name>` —— 指向正本的目录链接（Windows 下为 junction），**不要在这里改内容**
- 新增 Skill：在 `.agents/skills/` 建目录，再在 `.claude/skills/` 建同名链接
- `ui-ux-pro-max` 为第三方 Skill，独立维护，不属于本项目约定

## 清单

| Skill | 何时触发 | 解决的典型问题 |
|---|---|---|
| `verify-change` | 改完代码、准备提交、问「通过了吗」 | 验收门禁不统一；并行会话下误判全绿 |
| `prisma-migration-guard` | 改 schema、加迁移、部署涉库 | 迁移与 seed 漏审计，改坏生产数据 |
| `api-endpoint` | 新增/修改 API | 漏 zod、漏日志、漏权限登记、漏分页 |
| `ui-baseline` | 改任何前端 UI | 弹窗像素尺寸、字号过小、自造状态色 |
| `module-iteration` | 新建或改造一个业务模块 | 每个模块各发明一套形态；口径散落在业务目录 |
| `domain-pricing` | 碰价格/成本/单位/份量/库存份数 | 另写一套公式导致口径不一致 |
| `commit-hygiene` | `git add` / 提交 | 混入他人中间态、临时文件、密钥 |

## 维护规则

1. **只写这个仓库的真实约定**，通用最佳实践不进来（Claude Code 内置能力已覆盖）。
2. **引用而不复制**：指向 `CLAUDE.md`、`docs/`、`memory-bank/` 的具体章节，避免同一结论两处维护。
3. 约定发生变化时，**同一次提交**里更新对应 Skill；过期 Skill 比没有 Skill 更危险。
4. 新增 Skill 必须能回答：触发场景是什么、不遵守会造成什么具体后果。
5. 单个 SKILL.md 控制在 150 行内，超出则拆 `references/` 子文件。
