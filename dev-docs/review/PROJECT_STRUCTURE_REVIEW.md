# Project Structure Review

## 1. 当前目录结论

当前目录结构总体合理，已经具备长期项目的分层雏形：

```text
apps/web       Next.js PWA
apps/server    Fastify + Socket.IO local daemon
packages/core  domain contracts, DTOs, status, Agent SPI
packages/db    SQLite client, migrations, repository
packages/runtime platform operations
packages/agents built-in Agent adapters
dev-docs       internal source of truth
docs           user-facing local development docs
```

这个分层适合 NCC AI OS 继续发展，但需要从“功能包分层”升级到“平台能力分层”。未来 GitHub、Vercel、Docker、Telegram、MCP、Workflow 都不能直接塞进 `apps/server/src/services`，必须通过插件和命令队列进入系统。

## 2. 模块耦合审查

| 模块 | 当前职责 | 主要问题 | 风险 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/server/src/server.ts` | 创建 server、注册所有 routes、组装 services/socket | 文件会持续膨胀，HTTP route 和 service wiring 混在一起 | API 增多后难以审查权限、限流、schema 和错误处理 | 拆为 `routes/*`、`plugins/auth.ts`、`container.ts`，保留 `server.ts` 做组合入口 | M | server | P1 |
| `packages/db/src/repositories.ts` | 所有 repository 方法和 mapping | 单文件过大，所有表的读写集中 | Schema 扩展后 merge 冲突多，职责不清 | 按 aggregate 拆为 `sessions.repository.ts`、`logs.repository.ts`、`auth.repository.ts` 等；保留 facade | M | db, server | P1 |
| `packages/core/src/models.ts` | 所有实体类型 | 类型集中方便，但未来会过大 | 多人协作时改同一文件频繁冲突 | 按 domain 拆 `auth.ts`、`agent.ts`、`workspace.ts`、`command.ts`、`conversation.ts` | S-M | core, imports | P2 |
| `apps/web/app/*/page.tsx` | 页面状态、登录、session 恢复、API 调用 | 多页面重复 token/session/hydrate 逻辑 | 登录失效、session 切换、错误处理不一致 | 新增 `components/providers/auth-provider.tsx` 和 `hooks/use-current-session.ts` | M | web | P1 |
| `packages/agents` | 内置 Agent adapters | 只有静态 registry，没有 plugin/manifest | 新 Agent 接入需要改代码和 seed | 引入 Agent Provider Registry：manifest + capability + config schema | M-L | agents, core, server | P1 |
| `packages/runtime` | process/git/screenshot/metrics/path | 未来终端、Docker、浏览器、文件系统会变大 | 平台操作混杂后权限难控 | 保留 runtime 基础能力，新增 `runtime/providers/*` 和 policy 层 | M | runtime, server | P2 |
| `dev-docs` | 内部真源 | 旧名称仍是 AI Agent Console | 产品定位容易漂移 | 增加 NCC AI OS 命名和生产评审索引，后续再分阶段更新旧文档 | S | docs | P0 |

## 3. 需要拆分的目录或文件

### `apps/server/src/server.ts`

推荐拆分：

```text
apps/server/src/
  app.ts
  main.ts
  container.ts
  routes/
    auth.routes.ts
    dashboard.routes.ts
    sessions.routes.ts
    commands.routes.ts
    logs.routes.ts
    files.routes.ts
    screenshots.routes.ts
    notifications.routes.ts
    health.routes.ts
  middleware/
    auth.middleware.ts
    error-handler.ts
    rate-limit.ts
  socket/
    socket-server.ts
    socket-auth.ts
    event-bus.ts
```

原因：生产审查时每类 API 的 auth、schema、rate limit、audit 应在独立 route 模块中可见。

### `packages/db/src/repositories.ts`

推荐拆分：

```text
packages/db/src/
  repositories/
    auth.repository.ts
    workspace.repository.ts
    agent.repository.ts
    session.repository.ts
    command.repository.ts
    conversation.repository.ts
    log.repository.ts
    artifact.repository.ts
    notification.repository.ts
  console-repository.ts
```

原因：Command Queue、Conversation、Plugin、Audit Log 加入后，单文件会变成所有人都要改的瓶颈。

### `packages/core/src`

推荐拆分：

```text
packages/core/src/
  auth/
  workspace/
  agent/
  session/
  command/
  conversation/
  log/
  artifact/
  plugin/
  observability/
  api/
  socket/
```

原因：NCC AI OS 的核心语义会长期增长，核心包需要以 domain 边界组织，而不是一个 `models.ts` 承载所有对象。

## 4. 需要新增的目录

```text
packages/commands/
```

可选。如果命令逻辑只是一层类型和状态机，先放 `packages/core/src/command` 即可；当 worker、retry、policy、handler registry 变复杂后再抽包。当前推荐先不新增包，避免过早抽象。

```text
packages/plugins/
```

Beta 后新增。拥有 plugin manifest type、loader、registry、permission declaration、capability mapping。具体第三方插件可放：

```text
plugins/
  github/
  vercel/
  docker/
  telegram/
  mcp/
```

MVP 不需要立刻创建，先在设计文档中锁定边界。

```text
apps/server/src/workers/
```

Command Queue 和后台任务需要 worker。截图、Git refresh、deploy、test、workflow 都应由 worker 执行，而不是 HTTP handler 直接执行。

```text
apps/server/src/policies/
```

集中放 workspace path、command allowlist、plugin permission、agent sandbox、remote access policy。

## 5. 需要合并或避免的目录

当前不建议合并 `packages/agents` 和 `packages/runtime`。

原因：

- Agent adapter 是 vendor/protocol 边界。
- Runtime 是平台能力边界。
- Codex adapter 使用 runtime child process 是正确依赖方向。

当前也不建议把 `apps/server` 和 `apps/web` 合并为 Next.js API routes。

原因：

- UI 生命周期和长运行 Agent daemon 生命周期不同。
- NCC AI OS 需要守护进程、worker、进程恢复、日志归档和系统集成。

## 6. 命名调整建议

| 当前命名 | 建议命名 | 优先级 | 说明 |
| --- | --- | --- | --- |
| root package `ncc-ai-os` | keep | P0 | 根 package 已完成 NCC AI OS 命名；`@aic/*` workspace scope 后续再独立迁移。 |
| `@aic/*` | `@ncc-ai-os/*` 或 `@ncc/os-*` | P2 | 代码包名后迁移，先不要阻塞架构改造。 |
| `AI Agent Console` 文档标题 | `NCC AI Development OS` | P0 | 先改 active truth 和新增 review 文档。 |
| `dashboard` 作为产品中心 | `operations` / `control plane` | P2 | 页面名可保留，但架构语义应是 operations center。 |

## 7. 新建议目录结构

推荐中期结构：

```text
apps/
  web/
  server/
    src/
      main.ts
      app.ts
      container.ts
      routes/
      middleware/
      socket/
      workers/
      policies/
      services/
packages/
  core/
    src/
      auth/
      workspace/
      agent/
      session/
      command/
      conversation/
      plugin/
      observability/
  db/
    src/
      migrations/
      repositories/
  runtime/
    src/
      process/
      git/
      browser/
      metrics/
      workspace/
  agents/
    src/
      builtin/
      providers/
      registry.ts
  plugins/
    src/
      manifest.ts
      registry.ts
plugins/
  github/
  vercel/
  docker/
  telegram/
  mcp/
dev-docs/
  review/
docs/
  local-development.md
  deployment/
  operations/
```

## 8. 结构治理优先级

| 优先级 | 动作 | 原因 |
| --- | --- | --- |
| P0 | 固定 NCC AI OS 产品命名和边界 | 防止架构继续围绕 Codex 或单 Dashboard 漂移 |
| P0 | 引入 Command Queue schema 和 owner | 后续所有功能都要穿过它 |
| P1 | 拆 server routes 和 repository | 为多人开发和安全审查做准备 |
| P1 | 抽 web auth/session provider | 减少前端重复和状态不一致 |
| P1 | 增加 workers/policies 目录 | 后续截图、部署、测试、Docker、Terminal 都需要 |
| P2 | 包名从 `@aic` 迁移到 NCC 命名 | 非阻塞，等核心架构稳定后做 |

## 9. 标准评审矩阵

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| Server route 和 service wiring 集中在 `server.ts` | API 增长后权限、限流、错误和审计难以统一 | MVP 为了快速闭环把路由集中注册 | 拆分 `routes/`、`middleware/`、`container.ts` | M | apps/server | P1 |
| DB repository 单文件承载所有表 | 多人开发冲突多，Command/Plugin 增长后难维护 | 当前仓储仍是 MVP facade | 按 aggregate 拆 repository，保留 facade 兼容调用 | M | packages/db, apps/server | P1 |
| 前端页面重复 token/session 恢复逻辑 | 状态不一致，后续页面维护成本高 | 每个页面独立读取 localStorage 和 hydrate | 抽 `AuthProvider`、`CurrentSessionProvider` 和 hooks | M | apps/web | P1 |
| 缺少 workers/policies 目录 | 截图、测试、部署、Terminal 会继续挤进 HTTP handler | 还没有 Command Queue 和后台 worker | 新增 `workers/` 与 `policies/`，所有动作从 Queue 执行 | M | apps/server, packages/runtime | P0 |
| 命名仍残留 AI Agent Console / `@aic` | 长期产品定位容易退回单 Agent 控制台 | 项目从 Codex 远程监控需求起步 | 文档先统一 NCC AI OS，代码包名后续低风险迁移 | S-M | docs, package names, UI copy | P0 |
