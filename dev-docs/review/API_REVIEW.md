# API Review

## 1. 当前 API 结论

当前 REST API 覆盖了 MVP 核心页面：

- Auth。
- Dashboard。
- Workspaces read-only。
- Agents list。
- Sessions。
- Messages。
- Logs。
- File changes。
- Screenshots/artifacts。
- Notifications。

Socket.IO 当前主要用于：

- token handshake。
- user/session room。
- log line 推送。
- 部分 created/status events。

结论：REST 作为恢复源是正确的；Socket 作为实时传输也是正确的。但 API 还没有围绕 Command Queue、Conversation、Health、Plugin 做生产级边界。

## 2. REST / Socket / Queue 分工

推荐分工：

| 类型 | 适合内容 | 不适合内容 |
| --- | --- | --- |
| REST | 登录、查询、初始加载、断线恢复、分页、下载、创建 command | 长时间执行、实时日志、streaming token |
| Socket.IO | 状态变化、日志增量、command event、dashboard push、通知 | 作为唯一数据源、执行危险动作 |
| Command Queue | 所有会改变系统状态或触发 Agent/Runtime 的动作 | 纯查询 |
| SSE | 只读 streaming fallback，可选 | 双向控制 |

## 3. 当前 API 问题

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| REST route 直接触发动作 | 无统一审计、重试、取消 | MVP 直接调用 service | 触发动作改为 `POST /api/commands` 或内部创建 command | M | server, web | P0 |
| 缺少 request/response schema validation | 无效输入可能进入服务层 | Fastify 未注册 JSON schema/type provider | 为每个 route 加 schema 或轻量 validator | M | server | P1 |
| 错误响应不统一 | UI 难以分类处理，审查困难 | 直接 throw 或返回不同格式 | 统一 `ApiError { code, message, details?, requestId }` | S-M | server, web | P1 |
| CORS `origin: true` | 暴露 LAN/Tunnel 时风险高 | MVP 方便本地开发 | 生产模式要求 origin allowlist | S | server config | P0 |
| Socket client events 未完整实现 | API contract 和运行代码不一致 | socket-server 只处理 join/leave | 要么实现 send/stop/logs/dashboard subscribe，要么 contract 降级说明 | M | socket, docs | P1 |
| Artifact 下载无 session/workspace 权限校验 | 多用户/RBAC 后可能越权 | 当前单用户假设 | Artifact 读取加 owner/workspace 权限校验 | S-M | server, db | P1 |
| Workspaces 只读且 UI 固定 default | 多项目无法管理 | MVP 单 workspace | 增加 workspace CRUD，但先加 path policy | M | db, server, web | P1 |
| No API versioning | 未来移动端/PWA 缓存和插件兼容困难 | MVP 路径简单 | 正式版引入 `/api/v1` 或 negotiated version | S-M | server, web | P2 |

## 4. 推荐 API 结构

```text
/api/health
/api/auth/*
/api/users/*
/api/workspaces/*
/api/agents/*
/api/sessions/*
/api/conversations/*
/api/commands/*
/api/logs/*
/api/artifacts/*
/api/notifications/*
/api/plugins/*
/api/integrations/*
/api/observability/*
```

短期不必全部实现，但命名和 owner 要提前定下来。

## 5. REST 推荐

### Auth

保留：

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/tokens
POST /api/auth/tokens
DELETE /api/auth/tokens/:id
```

新增：

```text
POST /api/auth/bootstrap
GET  /api/auth/providers
```

生产要求：默认 admin 密码不能进入 production mode。

### Commands

新增：

```text
GET  /api/commands
POST /api/commands
GET  /api/commands/:id
GET  /api/commands/:id/events
POST /api/commands/:id/cancel
POST /api/commands/:id/approve
POST /api/commands/:id/retry
```

### Conversations

新增：

```text
GET  /api/sessions/:id/conversation
GET  /api/conversations/:id/messages
POST /api/conversations/:id/messages
GET  /api/conversations/:id/events?cursor=
POST /api/conversations/:id/attachments
```

### Health / Observability

新增：

```text
GET /api/health/live
GET /api/health/ready
GET /api/health/dependencies
GET /api/metrics
GET /api/audit-events
```

## 6. Socket 推荐

Socket 只做实时通知和增量数据：

```text
client:
  session:join
  session:leave
  workspace:join
  workspace:leave
  dashboard:subscribe
  dashboard:unsubscribe

server:
  command:created
  command:status_changed
  command:event
  conversation:message_created
  conversation:message_chunk
  log:line
  agent:status_changed
  workspace:changed
  dashboard:update
  notification:created
```

不建议通过 Socket 直接执行命令。即便手机通过 Socket 发“继续”，也应转换成 command。

## 7. Streaming 设计

Agent output streaming 应采用：

```text
Socket.IO for live chunks
REST cursor for recovery
```

流程：

```text
Agent emits chunk
  -> persist conversation_event/message_part_delta
  -> socket emits conversation:message_chunk
  -> client appends
  -> reconnect
  -> client calls GET events?cursor=lastSeen
```

SSE 可作为只读 fallback，但不是第一主线。

## 8. API 安全要求

| 要求 | 优先级 |
| --- | --- |
| 所有非 login/health/live route 必须鉴权 | P0 |
| Production mode 禁止 default secret/password | P0 |
| Origin allowlist | P0 |
| Rate limit login/token/commands | P0 |
| Request body size limit | P0 |
| Command payload validation | P0 |
| Artifact/workspace ownership checks | P1 |
| Audit log high-risk route/command | P1 |

## 9. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Recovery | 刷新或断网后 REST 能恢复 session/conversation/commands/logs |
| Live | Socket 只补实时事件，不是唯一真源 |
| Contract | `dev-docs/api-contract.md` 与代码 route/socket 一致 |
| Errors | UI 能根据 code 处理 unauthorized/not_found/invalid_payload/rate_limited |
| Queue | 所有动作 API 创建 command |

