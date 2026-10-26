# Memory Bank 索引

本目录记录项目级长期记忆，用于在会话上下文丢失时快速恢复项目背景。

## 文件清单

| 文件 | 内容 | 维护频率 |
|------|------|----------|
| `Product.md` | 产品定义、核心功能边界、目标用户 | 需求变更时 |
| `Database.md` | 数据模型详细设计、字段说明、关系图 | Schema 变更时 |
| `Router.md` | 页面路由树与交互设计 | 新增/调整页面时 |
| `Design.md` | UI 设计规范、组件样式约定 | 设计规范变更时 |
| `progress.md` | 项目推进日志、技术决策、已知问题与 TODO | 每日/每次迭代 |

## 使用方式

当进入新会话或上下文丢失时，优先按以下顺序恢复背景：

1. 阅读本索引文件
2. 根据当前任务选择对应的记忆文件深入阅读
3. 同时参考根目录 `CLAUDE.md` 和 `AGENTS.md`

## 相关文档

- 项目全局指南：`../CLAUDE.md`
- AI Agent 工作区指令：`../AGENTS.md`
- 子系统局部指南：`../app/components/dish-form/CLAUDE.md`、`../app/lib/CLAUDE.md`、`../prisma/CLAUDE.md`、`../app/api/*/CLAUDE.md`
