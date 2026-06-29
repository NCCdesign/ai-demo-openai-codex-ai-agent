# Telegram 真实链路验收

本文件用于验收当前 Sprint 的最后一段真实链路：

```text
Telegram
  -> Remote Console
  -> Command Queue
  -> Agent Runtime
  -> Codex Agent Adapter
```

Telegram 只是 Remote Console，不是 Agent，也不拥有业务逻辑。

## 前置条件

- 已创建 Telegram bot，并拿到 bot token。
- 已知道允许访问的 Telegram chat id。
- 本机 Codex CLI 可用。
- NCC AI OS 的 API 服务能访问 Telegram API。

不要把真实 token、chat id、`.env`、本地数据库或截图产物提交到仓库。

## 启动

```powershell
$env:AIC_TELEGRAM_BOT_TOKEN = "<bot-token>"
$env:AIC_TELEGRAM_ALLOWED_CHAT_IDS = "<chat-id>"
$env:AIC_CODEX_COMMAND = "C:\Users\USER\.codex\.sandbox-bin\codex.exe"
pnpm --filter @aic/server start
```

另开一个终端启动 Web：

```powershell
pnpm --filter @aic/web dev
```

## 验收步骤

1. 在 Web 中登录。
2. 创建或选择一个 `Codex CLI` session。
3. 在 Telegram 发送 `/status`。
4. 在 Telegram 发送 `/logs`。
5. 在 Telegram 发送 `/continue 回答 OK 即可`。
6. 确认服务端创建了 `source = telegram` 的 `agent.continue` command。
7. 确认 Runtime 进入 `running`，然后到 `waiting` 或 `completed`。
8. 在 Telegram 发送 `/pause`。
9. 确认服务端创建了 `source = telegram` 的 `agent.pause` command，Runtime 进入 `waiting`。
10. 在 Telegram 发送 `/resume`。
11. 确认服务端创建了 `source = telegram` 的 `agent.resume` command，Runtime 回到 `running`。
12. 在 Telegram 发送 `/stop`。
13. 确认服务端创建了 `source = telegram` 的 `agent.stop` command，Runtime 进入 `cancelled`，并且 `pid = null`。

## 证据查询

登录后拿到 bearer token，再查询 command：

```powershell
curl.exe -H "Authorization: Bearer <token>" "http://127.0.0.1:4317/api/commands?sessionId=<session-id>&limit=20"
```

查询 Runtime：

```powershell
curl.exe -H "Authorization: Bearer <token>" "http://127.0.0.1:4317/api/sessions/<session-id>/runtime"
```

查询 Agent Stream：

```powershell
curl.exe -H "Authorization: Bearer <token>" "http://127.0.0.1:4317/api/sessions/<session-id>/stream?cursor=0&limit=200"
```

## 通过标准

- `/status` 能从真实 Telegram chat 返回当前 session/runtime/stream/log 摘要。
- `/logs` 能返回最近日志。
- `/continue`、`/pause`、`/resume`、`/stop` 全部进入 Command Queue。
- Command 的 `source` 全部是 `telegram`。
- Codex-backed Runtime 状态按命令变化。
- Telegram 没有直接调用 Agent Adapter 或 Runtime 私有状态。
- 验收结果写回 `dev-docs/acceptance.md`。
