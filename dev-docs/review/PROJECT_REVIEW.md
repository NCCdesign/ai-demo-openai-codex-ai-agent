# NCC AI Development OS Project Review

审查日期：2026-06-29
审查范围：当前 `main` 分支，本地源码、`dev-docs` 真源、SQLite schema、Server/Web/Agent/Runtime 主流程。
产品命名结论：正式产品应命名为 **NCC AI Development OS**，简称 **NCC AI OS**。`Codex Dashboard` 或 `AI Agent Console` 只能作为早期阶段历史称呼，不能继续作为产品边界。

## 1. 项目定位是否合理

结论：定位合理。当前 active truth、README 和 UI 标题已经升级为 **NCC AI Development OS / NCC AI OS**；剩余命名问题主要是内部 workspace scope `@aic/*` 和历史评审中的阶段性措辞，不能让这些实现细节重新收窄产品边界。

NCC AI OS 的正确定位不是某一个 Agent 的控制台，而是本地优先的 AI 开发操作系统。它应该统一管理 Agent、项目、会话、命令、日志、截图、Git、部署、通知、知识库和自动化工作流。

现有架构主线是合理的：

```text
Next.js PWA
  -> authenticated local Node daemon
  -> core contracts + SQLite persistence
  -> agent adapters + runtime services
  -> local artifacts/logs
```

这个主线适合长期演进，因为 UI、后端守护进程、核心契约、数据库、Agent 适配器和本地运行时已经分层。真正的问题不是方向错，而是当前仍缺少生产级控制面应有的持久命令队列、插件边界、可观测性、安全策略和部署治理。

## 2. 架构评分

| 维度 | 评分 | 说明 |
| --- | ---: | --- |
| Architecture | 7/10 | 分层方向正确，`core/db/runtime/agents/server/web` 边界清楚；但命令、事件、插件、部署尚未成为一等架构对象。 |
| Scalability | 5/10 | 类型上预留多 Agent，但运行态依赖内存 Map，缺少多项目、多 Workspace、多 Session 并发调度和队列。 |
| Maintainability | 6/10 | Monorepo 和共享 DTO 有利维护；但 `server.ts`、`repositories.ts` 逐渐变大，前端页面有重复登录/session 逻辑。 |
| Security | 4/10 | 已有 token hash、登录和部分路径限制；但默认密钥、CORS、限流、RBAC、HTTPS、命令注入、Prompt/Tool 注入策略不足。 |
| Deployment | 3/10 | 有本地开发说明；缺少 Docker、systemd、PM2、Windows Service、备份、自动恢复、Tunnel、HTTPS 方案。 |
| Performance | 5/10 | MVP 数据量下可用；日志和 Diff 缺少分页/虚拟滚动/归档，SQLite 写入和 Socket 广播还没有背压。 |
| Code Quality | 5.5/10 | 代码短、直接、可读，符合 MVP；但中文字符串出现乱码，错误模型不统一，缺少模块级 API schema 校验。 |
| Observability | 4/10 | 有 session logs 和 dashboard 指标；缺少结构化日志、health dependency、metrics、trace、日志轮转和审计日志。 |
| AI Agent Design | 5/10 | AgentAdapter SPI 是好起点；但 Agent Conversation、Tool Call、Command Queue、Capability、状态恢复都还不足。 |

总体评分：5.0/10。

这是一个方向正确、工程骨架可继续扩展的本地 MVP，不是生产平台。

## 3. 当前阶段判定

当前属于：**MVP**。

不是 Prototype 的原因：

- 已有可运行 monorepo。
- 已有 Next.js PWA、Fastify Server、Socket.IO、SQLite、AgentAdapter、runtime、auth、logs、screenshots、file changes。
- 已有 `pnpm check` / `pnpm build` 记录和多条 smoke evidence。
- 已有 `dev-docs` 真源和项目宪法。

不是 Beta 的原因：

- 多 Workspace 仍是只读种子数据。
- 多 Agent 并发和状态恢复未完成。
- 命令没有统一进入 Command Queue。
- 插件系统未实现。
- 部署、安全、观测、备份还不是稳定日常运行级别。

不是 Production Ready 的原因：

- 不能直接公网暴露。
- 默认密码和默认 token secret 仍存在。
- 缺少 HTTPS/OAuth/RBAC/Cloudflare Access 指南。
- 日志、命令、Agent runtime 无完整恢复、重放、审计和清理策略。
- 没有服务化部署、自动恢复和备份。

## 4. 核心问题清单

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| 产品命名需要持续防漂移 | 后续围绕 Codex 或单 Agent 继续设计，平台边界变窄 | 初始 MVP 从 Codex 监控需求启动，内部 `@aic/*` 包名仍是历史实现细节 | 保持 active truth 为 NCC AI OS；历史名称只作为阶段背景；代码包名后续分阶段迁移 | S | docs, README, UI copy | P0 |
| 缺少统一 Command Queue | 停止、继续、截图、测试、部署等行为分散直连服务，无法审计和重试 | MVP 直接用 REST endpoint 完成闭环 | 新增 command owner：命令表、状态机、worker、幂等 key、取消语义；所有控制动作都入队 | M-L | core, db, server, web, agents | P0 |
| Agent 运行态不持久 | Server 重启后无法知道子进程真实状态，长期值守不可靠 | Codex/Noop adapter 用内存 Map 管理 session handle | 引入 Agent Runtime Supervisor，持久化 runtime heartbeat、pid、capabilities、last_seen、recover_policy | L | agents, runtime, server, db | P0 |
| 安全边界不足 | 公网或 Tunnel 暴露后存在账户、命令、文件和 Agent 滥用风险 | 当前以可信 LAN MVP 为边界 | 生产模式禁止默认密钥；加 origin allowlist、rate limit、RBAC、audit log、path policy、command policy | M-L | server, config, docs | P0 |
| 可观测性不足 | 报错时只能靠页面和 SQLite 日志排查，无法长期运营 | 日志和指标还服务于页面，而不是运维 | 建立 health checks、structured logs、metrics endpoint、dependency status、log rotation | M | server, runtime, docs | P1 |
| 部署治理缺失 | 不能稳定开机自启、自动恢复、备份和远程访问 | 当前只有 local dev 文档 | 建立 Windows/Linux/Docker/Compose/Cloudflare Tunnel 部署路径 | M | docs, scripts, server config | P1 |
| 插件架构未实现 | Telegram、GitHub、Vercel、Docker、MCP 接入会散落在服务层 | 当前只有内置模块 | 定义 Plugin Manifest、capability、permissions、hooks、command handlers、UI extension points | L | core, server, web, packages/plugins | P1 |
| Chat 不是完整 Agent Conversation | 无 tool call、streaming chunks、attachments、memory、command lifecycle | MVP messages 表只保存 role/content | 扩展 conversation/event model：message parts、tool calls、attachments、memory refs、branching | L | core, db, server, web | P1 |
| 前端重复 auth/session 逻辑 | 后续页面越多重复越多，状态不一致 | 每个页面本地读取 token/session | 抽出 web client session provider 和 hooks；React Query 化 | M | apps/web | P2 |
| 中文 UI 文案乱码 | 用户体验和维护性下降，公开仓库审查观感差 | 编码链路或终端写入方式导致 mojibake | 统一 UTF-8，建立 i18n/copy source，添加乱码扫描 check | S-M | apps/web, apps/server | P1 |

## 5. 推荐主线

NCC AI OS 的下一阶段不应继续堆页面。推荐按以下主线推进：

```text
NCC AI OS truth drift lock
  -> Command Queue
  -> durable Agent Runtime Supervisor
  -> event/log/health observability
  -> security hardening
  -> deployment baseline
  -> plugin capability system
```

前端只在这些核心控制面稳定后再扩展 Terminal、Git、Docker、Deploy、Knowledge Base 等页面。

## 6. 停止条件

本轮评审完成的停止条件：

- 评审文档完整进入 `dev-docs/review/`。
- `dev-docs/README.md` 索引所有评审文档。
- 不修改业务代码。
- 明确当前是 MVP，不声明生产可用。
