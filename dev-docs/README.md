# NCC AI Development OS 开发真源

这个目录是项目内部真源。修改架构、API 契约、数据库 schema、Runtime 行为或 UI 工作流前，必须先读本索引。

正式产品名是 **NCC AI Development OS**，简称 **NCC AI OS**。`AI Agent Console` 只代表早期 MVP 范围，`Codex Dashboard` 是明确禁止的产品定位。Codex 只是第一个 Agent Provider，不能把后续架构重新收窄到单一模型或单一 Dashboard。

## 当前真源文档

- [Project Initiation](project-initiation.md): 产品边界、目标、非目标、首个闭环、停止条件。
- [Architecture](architecture.md): owner layer、依赖方向、模块职责、Runtime 边界。
- [API Contract](api-contract.md): REST 与 Socket.IO 契约。
- [Database Schema](database-schema.md): SQLite-first 持久化模型和迁移约束。
- [Implementation Plan](implementation-plan.md): 当前 Sprint、MVP、Beta、正式版开发顺序。
- [Acceptance](acceptance.md): 验收门禁、ready 语言、漂移锁。

## 生产级架构评审

- [Executive Summary](review/EXECUTIVE_SUMMARY.md): 生产级架构评审结论和下一优先级。
- [Project Review](review/PROJECT_REVIEW.md): 产品定位、架构评分、当前阶段、核心风险。
- [Project Structure Review](review/PROJECT_STRUCTURE_REVIEW.md): 目录/模块耦合审查和推荐结构。
- [Agent Architecture](review/AGENT_ARCHITECTURE.md): Agent Runtime、多 Agent、多 workspace、多 session 设计审查。
- [Chat System Review](review/CHAT_SYSTEM_REVIEW.md): Agent Conversation、history、streaming、tool call、attachment、memory 方向。
- [Dashboard Review](review/DASHBOARD_REVIEW.md): 操作中心 Dashboard 审查和未来信息架构。
- [Command Queue Design](review/COMMAND_QUEUE_DESIGN.md): continue、stop、screenshot、deploy、test、plugin 的统一命令模型。
- [API Review](review/API_REVIEW.md): REST、Socket.IO、streaming、queue 边界审查。
- [Realtime Architecture](review/REALTIME_ARCHITECTURE.md): WebSocket-first 实时架构、重连和恢复模型。
- [Logging Plan](review/LOGGING_PLAN.md): agent/system/server/command/terminal 日志、轮转和留存计划。
- [Observability](review/OBSERVABILITY.md): health check、metrics、dashboard monitoring、alert 设计。
- [Security Review](review/SECURITY_REVIEW.md): Critical/High/Medium/Low 安全风险审查和加固计划。
- [Deployment Plan](review/DEPLOYMENT_PLAN.md): Windows、Linux、Docker、Compose、Tunnel、HTTPS、自动恢复和备份计划。
- [Plugin Architecture](review/PLUGIN_ARCHITECTURE.md): plugin manifest、capability、permission、registry、MCP/integration 设计。
- [Project Roadmap](review/PROJECT_ROADMAP.md): Sprint 1 到 production release 路线图。

## 外部运行文档

- [Local Development](../docs/local-development.md): 本地安装、运行、检查和手机访问。
- [Telegram 真实链路验收](../docs/telegram-live-smoke.md): 真实 Telegram 端到端验收步骤。

## 真源优先级

1. 当前代码、schema、迁移、测试、日志和命令输出。
2. 根目录 `AGENTS.md`。
3. 本索引和上方 active docs。
4. archive 或历史文档只能作为背景。

## 归档规则

一次性计划和已完成审计必须移动到 `dev-docs/archive/`，或在替代它的 active doc 中标记为已吸收。不要保留平行 active plan。
