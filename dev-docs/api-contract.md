# API Contract

All routes are served by `apps/server`. Unless stated otherwise, routes require bearer token authentication.

## Auth

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/auth/tokens
POST   /api/auth/tokens
DELETE /api/auth/tokens/:id
```

Token management uses bearer auth. `GET /api/auth/tokens` returns token metadata only. `POST /api/auth/tokens` returns the plaintext token once plus metadata. `DELETE /api/auth/tokens/:id` revokes that token for the authenticated user.

`POST /api/auth/logout` revokes the current bearer token.

## Dashboard

```text
GET /api/dashboard
```

Returns current session/task status, duration, optional system metrics, recent file changes, Git branch/commit, and workspace path.

## Workspaces

```text
GET    /api/workspaces
GET    /api/workspaces/:id
```

MVP exposes read-only workspace discovery for the seeded local workspace. Workspace create/update/delete are reserved for the multi-workspace Beta phase and must not be faked in UI.

## Agents

```text
GET  /api/agents
```

Agent status/enable/disable endpoints are reserved for the Beta agent configuration page. MVP session status comes from persisted sessions and adapter events, not per-agent control routes.

## Sessions

```text
GET  /api/sessions?limit=20
POST /api/sessions
GET  /api/sessions/:id
GET  /api/sessions/:id/runtime
POST /api/sessions/:id/stop
```

`GET /api/sessions` returns recent persisted sessions with agent/workspace display data, message count, and `lastMessageAt`. `GET /api/sessions/:id` returns the session detail with full agent and workspace records. These REST routes are the recovery path after browser refresh or mobile reconnect; clients must not reconstruct session state from only local storage or Socket.IO events.

`GET /api/sessions/:id/runtime` returns the durable Agent Runtime instance for the session. Runtime status values are provider-neutral:

```text
idle | planning | running | waiting | tool_calling | completed | failed | cancelled
```

This route is the current read path for future Telegram status views. It reads SQLite state; it does not inspect adapter memory.

Session restart is reserved for a later lifecycle policy. MVP supports creating a new session and stopping an existing one.

## Commands

```text
GET  /api/commands?sessionId=:sessionId&limit=50
POST /api/commands
GET  /api/commands/:id
```

`POST /api/commands` is the single server-side entry point for control commands. UI, future Telegram remote console, and API clients create command records instead of directly controlling Agent Runtime.

Compatibility routes such as `POST /api/sessions/:id/messages` and `POST /api/sessions/:id/stop` are also queue-backed: they persist the user-facing message or request, create the matching command, and wake the command worker. They must not call Agent adapters directly.

Initial command types:

```text
agent.continue
agent.pause
agent.resume
agent.stop
agent.cancel
agent.restart
agent.screenshot
workspace.test.run
workspace.deploy.run
```

Initial command status values:

```text
queued | running | waiting_for_user | completed | failed | cancelled | timed_out
```

Request:

```json
{
  "type": "agent.continue",
  "sessionId": "ses_x",
  "source": "api",
  "payload": {}
}
```

This API persists queued commands and emits `command:created`. The server-side command worker executes `agent.continue`, `agent.pause`, `agent.resume`, `agent.stop`, and `agent.cancel`, then emits `command:status_changed`. Reserved command types without handlers fail explicitly instead of pretending to run.

Telegram Remote Console uses the same command contract internally through `CommandService`; it must not call `SessionService`, `AgentRuntimeService`, or Agent adapters directly for control actions.

Supported Telegram commands:

```text
/status [sessionId]
/logs [sessionId]
/continue [text]
/pause
/resume
/stop
```

Telegram status/log commands are read-only views over persisted runtime/log state. Telegram control commands create queued commands with `source = telegram`.

Outbound Telegram notifications currently mirror:

```text
agent_runtime:status_changed
command:created
command:status_changed
log:line
```

Telegram notification failures are logged by the server and must not interrupt API, Socket.IO, or Agent Runtime execution.

## Messages

```text
GET  /api/sessions/:id/messages
POST /api/sessions/:id/messages
```

Request:

```json
{
  "content": "继续",
  "contentFormat": "markdown"
}
```

## Logs

```text
GET /api/sessions/:id/logs?cursor=0&limit=500&query=error&stream=stderr
GET /api/sessions/:id/logs/download
```

`GET /api/sessions/:id/logs/download` returns an authenticated `text/plain` attachment built from persisted logs in SQLite. It is the full session log export path and must not depend on the client page's current cursor, search query, or visible rows.

## Files

```text
GET /api/sessions/:id/file-changes
GET /api/file-changes/:id/diff
```

## Screenshots And Artifacts

```text
GET  /api/sessions/:id/screenshots
POST /api/sessions/:id/screenshots
GET  /api/artifacts/:id
```

`POST /api/sessions/:id/screenshots` accepts an optional absolute local `http(s)` URL. Non-local URLs return `400 invalid_screenshot_url`. The artifact pipeline remains successful when local browser capture is unavailable; in that case the session log records a warning and the artifact is an explicit placeholder PNG.

## Notifications

```text
GET   /api/notifications
PATCH /api/notifications/:id/read
POST  /api/notifications/test
```

## Socket.IO Rooms

```text
user:{userId}
workspace:{workspaceId}
session:{sessionId}
```

## Client Events

```text
session:join
session:leave
session:send_message
session:stop
logs:subscribe
logs:unsubscribe
dashboard:subscribe
dashboard:unsubscribe
```

## Server Events

```text
dashboard:update
session:created
session:status_changed
agent_runtime:status_changed
message:created
command:created
command:status_changed
log:line
file_change:created
screenshot:created
notification:created
error
```

Socket events are live transport only. REST plus database persistence is the recovery source after refresh or reconnect.
