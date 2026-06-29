# Realtime Architecture

## 1. 当前实时通信结论

当前项目使用 Socket.IO，这是正确选择。手机远程查看 Agent 进度、日志和通知时，不应依赖每秒轮询。

但当前实时层仍然偏 MVP：

- Socket 鉴权存在。
- user/session room 存在。
- logs 页面订阅 `log:line`。
- Dashboard 仍以 10 秒 REST 轮询为主。
- Socket client events 与 `dev-docs/api-contract.md` 不完全一致。
- 没有断线恢复 cursor。
- 没有 command/conversation 统一事件流。

## 2. 不使用每秒轮询

原则：

- UI 首屏和刷新使用 REST。
- 实时增量使用 Socket.IO。
- 断线恢复使用 REST cursor。
- 后端 worker 内部可以短间隔轮询 SQLite command queue，直到引入更强队列。

Dashboard 每 10 秒刷新可以作为 MVP fallback，但正式版应该由 Socket 推送。

## 3. 实时事件分层

推荐事件总线：

```text
Domain Event
  -> Persist event/log/command_event
  -> Publish to EventBus
  -> Socket.IO room broadcast
  -> optional notification delivery
```

不要让 service 手动到处 `io.to(...).emit(...)`。当前 server route 内手动 emit 会随着功能增加变散。

## 4. 推荐 Socket rooms

```text
user:{userId}
workspace:{workspaceId}
session:{sessionId}
command:{commandId}
conversation:{conversationId}
agent:{agentId}
system
```

权限规则：

- 用户连接后自动加入 `user:{id}`。
- 加入 workspace/session/command/conversation room 前，服务端检查权限。
- 插件不能直接操作 socket room，只能发布 domain event。

## 5. 连接管理

| 问题 | 风险 | 原因 | 推荐方案 | 预计工作量 | 影响范围 | 优先级 |
| --- | --- | --- | --- | --- | --- | --- |
| token 只在 handshake 校验 | token 被撤销后连接仍可能保持 | Socket 连接建立后没有 revoke/revalidate 流程 | 定期校验或 token revoked event 强制断开 | S-M | socket, auth | P1 |
| join session 不校验 session ownership | 多用户/RBAC 后可能越权订阅 | 当前 `session:join` 只加入 room，不查资源归属 | join 前查 session/workspace/user permission | S | socket, db | P1 |
| 无 heartbeat/connection state UI | 手机断线后用户不知道是否实时 | 前端没有展示 socket connected/reconnecting/stale 状态 | 前端显示 realtime connected/reconnecting/stale | S | web | P2 |
| 无恢复 cursor | 断线期间事件丢失 | Socket event 没有统一持久 cursor | 每类事件有 cursor，重连后 REST 拉取缺口 | M | db, server, web | P1 |
| 手动 emit 分散在 routes | 事件语义不一致 | route/service 直接调用 `io.to(...).emit(...)` | 建立 server EventBus 统一发布 | M | server | P1 |

## 6. 断线恢复设计

客户端保存：

```text
lastLogId per session
lastCommandEventId per command
lastConversationEventId per conversation
lastDashboardVersion
```

重连：

```text
socket reconnect
  -> rejoin rooms
  -> GET /api/sessions/:id/logs?cursor=lastLogId
  -> GET /api/conversations/:id/events?cursor=lastConversationEventId
  -> GET /api/commands/:id/events?cursor=lastCommandEventId
  -> merge and dedupe by id
```

## 7. Streaming

Agent streaming 不应该只存在前端内存。推荐：

```text
agent token/chunk
  -> append conversation_event(type=message_chunk)
  -> socket conversation:message_chunk
  -> periodically compact into message_part content
```

这样手机锁屏、网络切换、刷新后仍可恢复。

## 8. 消息队列与实时事件

Command Queue 是状态源，Socket 是状态通知：

```text
command row updated
  -> command_event inserted
  -> socket command:status_changed
  -> dashboard aggregate invalidated
```

不能反过来让 socket message 成为 command 的唯一存在。

## 9. 推荐事件格式

```json
{
  "id": 123,
  "type": "command:status_changed",
  "scope": {
    "workspaceId": "wks_default",
    "sessionId": "ses_x",
    "commandId": "cmd_x"
  },
  "payload": {},
  "createdAt": "2026-06-29T00:00:00.000Z"
}
```

所有实时事件应有：

- monotonic id 或 cursor。
- type。
- scope。
- payload。
- createdAt。

## 10. 验收标准

| 验收项 | 标准 |
| --- | --- |
| Dashboard | 主要状态由 Socket 更新，REST 仅首屏/恢复 |
| Logs | 断线期间缺失日志可由 cursor 补齐 |
| Commands | command status change 实时展示且可恢复 |
| Conversations | streaming chunk 可恢复 |
| Security | join room 检查权限 |
| Token revoke | logout/revoke 后 socket 不继续接收敏感事件 |
