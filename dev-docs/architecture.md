# NCC AI Development OS Architecture

## Decision

Use one single recommended architecture: a Next.js PWA front end talks to a separate local Node daemon over REST and Socket.IO. The daemon owns long-running Agent sessions, persistence, logs, screenshots, notifications, local runtime integration, and future workflow/plugin orchestration for **NCC AI Development OS**.

This is intentionally not a menu of equal options. Running Agent control inside Next.js API routes is rejected because UI hosting and process orchestration have different lifecycles.

## Mainline Architecture

```text
PWA browser / iPhone
  -> apps/web (Next.js)
  -> REST + Socket.IO
  -> apps/server (Node daemon)
  -> packages/core contracts
  -> packages/db repositories
  -> packages/agents adapters
  -> packages/runtime platform services
  -> SQLite + local artifact storage
```

The Node daemon is the long-running process owner. Next.js is the UI shell and should not manage agent child processes directly.

## Owner Layers

### `packages/core`

Owns:

- Entity types.
- Status enums.
- API DTOs.
- Socket event payload types.
- Agent Adapter SPI.
- Session state transitions.
- Agent Runtime status values and session-to-runtime status mapping.
- Command Queue types and state transitions.

Forbidden:

- Node process APIs.
- SQLite client imports.
- Next.js imports.
- Vendor SDK imports.

### `packages/db`

Owns:

- SQLite connection.
- Migrations.
- Repository interfaces and implementations.
- Row-to-domain mapping.

Forbidden:

- HTTP response formatting.
- UI state.
- Agent vendor-specific execution.

### `packages/runtime`

Owns:

- Child process runner.
- Log buffering.
- Git summary and diffs.
- File watcher.
- System metrics.
- Browser screenshot runner.
- Workspace path safety helpers.

Forbidden:

- Auth decisions.
- HTTP route ownership.
- UI formatting.

### `packages/agents`

Owns:

- Built-in Agent Adapter implementations.
- Codex-compatible process adapter that starts a CLI child process through `packages/runtime`.
- Provider-native output normalization. Codex maps JSONL stdout from `codex exec --json` when configured and emits provider events as core stream drafts.
- No-op/demo adapter for development checks.

Forbidden:

- Database schema.
- Web UI state.
- Cross-agent lifecycle policy.

### `apps/server`

Owns:

- Config.
- Auth.
- REST API.
- Socket.IO server.
- Service orchestration.
- Agent Runtime instance lifecycle, heartbeat, and recovery preparation.
- Command Queue worker orchestration.
- Event persistence.
- Artifact storage.
- Notification interface.

Forbidden:

- Duplicating core status definitions.
- Returning fake metrics as truth.
- Allowing filesystem access outside registered workspaces.

### `apps/web`

Owns:

- Next.js app router.
- PWA shell.
- Responsive navigation.
- Dashboard, chat, logs, files, screenshots, settings pages.
- Client API and socket bindings.

Forbidden:

- Owning domain status semantics.
- Direct filesystem/process access.
- Mocking live status without marking it as demo/unavailable.

## Dependency Direction

```text
apps/web -> packages/core
apps/server -> packages/core, packages/db, packages/agents, packages/runtime
packages/agents -> packages/core, packages/runtime
packages/db -> packages/core
packages/runtime -> packages/core
packages/core -> no project packages
```

## Data Flow

User command:

```text
Web / API / Telegram Remote Console command input
  -> POST /api/commands
  -> command service validates session/workspace/agent
  -> packages/db persists queued command, audit fields, and command event
  -> command worker marks command running
  -> session service calls AgentAdapter control method
  -> adapter/runtime emits logs/events
  -> server persists command status, duration, exit/error context, and logs
  -> Socket.IO broadcasts command/status/log updates
```

`agent.continue`, `agent.pause`, `agent.resume`, `agent.stop`, `agent.cancel`, and `agent.restart` now execute through the server-side command worker. `agent.pause` and `agent.resume` call explicit `AgentAdapter.pause/resume` methods; they must not be implemented as magic text sent through `sendMessage`. `agent.restart` stops the current provider handle, keeps the same logical Session, clears stale terminal timestamps/errors, starts the adapter again with the persisted workspace/agent identity, and writes the new Runtime status/pid back to SQLite. `agent.screenshot`, `workspace.test.run`, and `workspace.deploy.run` are reserved command types and fail explicitly until their handlers are implemented. HTTP routes must not bypass the queue for new control actions.

The `commands` row is the current execution audit record. It carries `task_id`, normalized `command_text`, `tool_name`, `started_at`, `completed_at`, `duration_ms`, retry/error fields, and `exit_code` when available. This keeps Telegram and mobile recovery views tied to persisted truth instead of transient worker memory. A future `command_attempts` table may be added when real multi-attempt retry semantics are implemented.

The legacy-compatible chat and stop routes are thin adapters over the queue:

```text
POST /api/sessions/:id/messages
  -> persist user message
  -> create agent.continue command with payload.text
  -> command worker delivers the text to the Agent adapter

POST /api/sessions/:id/stop
  -> create agent.stop command
  -> command worker stops the Agent adapter
```

Agent selection:

```text
session.agentId
  -> db agents.type
  -> AgentRegistry.get(type)
  -> AgentAdapter
```

No HTTP route or UI component is allowed to special-case Codex. Codex is one Agent Provider behind the shared SPI, not the product boundary.

Agent Runtime instance:

```text
POST /api/sessions
  -> sessions table creates logical conversation/session
  -> agent_runtime_instances creates durable runtime row
  -> AgentAdapter starts local provider process/session
  -> AgentRuntimeService maps SessionStatus to AgentRuntimeStatus
  -> heartbeat_at updates from adapter events and daemon heartbeat ticker
  -> GET /api/sessions/:id/runtime reads persisted runtime truth
  -> agent_runtime:status_changed broadcasts live status transport
```

Runtime status is provider-neutral:

```text
idle | planning | running | waiting | tool_calling | completed | failed | cancelled
```

The current heartbeat is a local-daemon liveness baseline, not automatic supervisor recovery. Recovery policy is persisted as `manual`; operators can enqueue `agent.restart` to restart the same logical Session after a failure or stale-runtime reconciliation, while unattended auto-restart policy remains future work. On daemon start, `AgentRuntimeService` reconciles stale active runtime rows whose heartbeat is older than the configured threshold by marking them `failed` with a manual-recovery error. This prevents mobile and Telegram clients from seeing ghost running sessions after a daemon restart. Telegram, Web, and future plugins must read runtime status through API/socket contracts and must not inspect adapter memory.

Agent process startup must not create fake running state. `packages/runtime.startProcess` returns a structured `startError` when spawn fails before a child exists. The Codex adapter maps that to a failed Agent handle, system error log, and durable `agent_stream_events` error. `SessionService` then persists session/runtime status as `failed`, so Telegram and Web recovery paths show the unavailable reason instead of a running process that never existed.

The Codex process adapter now exposes explicit pause/resume controls through the shared Adapter SPI. On Unix-like hosts this uses `SIGSTOP`/`SIGCONT` through `packages/runtime`; on Windows the process runner currently returns a structured unsupported result, so the command fails instead of pretending the process paused. A Windows-safe process-tree pause/resume strategy or Codex-native `exec resume` lifecycle is still required before claiming full live Codex pause/resume readiness on Windows.

Agent Stream events:

```text
AgentRuntimeService status callback
CommandWorker status callback
SessionService log callback
AgentAdapter stream callback
  -> AgentStreamService
  -> agent_stream_events table
  -> agent_stream:event socket event
  -> GET /api/sessions/:id/stream replay
  -> selected TelegramRemoteConsole stream summary
```

`agent_stream_events` is the durable recovery stream for mobile reconnects and remote consoles. It currently normalizes runtime status changes, command progress, logs/tokens, errors, and provider-native stream drafts from Agent adapters. Codex stream drafts come from JSONL stdout such as `codex exec --json`, not from guessing terminal prose. `tool_call` and `tool_result` are first-class contract values, but built-in adapters must only emit them when they have a concrete tool name/result from the provider; a `tool_calling` runtime status alone remains a `status_change` event. Telegram receives stream summaries only for event types that are not already covered by dedicated runtime/command/log notifications, starting with `tool_call` and `tool_result`.

Telegram Remote Console:

```text
Telegram getUpdates
  -> TelegramRemoteConsole transport
  -> RemoteConsoleService
  -> read runtime/log state from repository services
  -> create control commands through CommandService
  -> publish command:created and wake CommandWorker
  -> AgentAdapter receives control through normal Command Queue execution
```

Outbound Telegram sync:

```text
AgentRuntimeService status callback
CommandWorker status callback
SessionService log callback
AgentStreamService event callback
  -> TelegramRemoteConsole notify*
  -> allowlisted Telegram chats
```

Telegram is not an Agent Provider and does not own business rules. It is disabled unless `AIC_TELEGRAM_BOT_TOKEN` and `AIC_TELEGRAM_ALLOWED_CHAT_IDS` are configured. The transport is allowlisted by chat id and currently supports `/status`, `/logs`, `/continue`, `/pause`, `/resume`, and `/stop`, plus outbound status/log/command notifications and selected stream summaries. SQLite and REST replay remain the recovery source of truth.

`/status` is a persisted runtime summary, not a terminal scrape. It reads the latest session/runtime/workspace/agent data, the latest logs, and recent `agent_stream_events` to show current step, current file, and current tool context when available. The stream summary is derived in `RemoteConsoleService`; the Telegram transport only formats and sends text.

Log replay:

```text
Runtime process stream
  -> log service
  -> logs table
  -> socket log:line
  -> GET logs endpoint for refresh/replay
```

Screenshot:

```text
POST screenshot request
  -> screenshot service
  -> local URL validation
  -> runtime browser runner
  -> local artifact store
  -> artifacts table
  -> screenshot:created socket event
```

MVP screenshot capture uses a local system Chromium browser when available (`AIC_BROWSER_COMMAND`, Edge, Chrome, or common Linux Chromium commands). If browser capture fails, runtime writes a valid placeholder PNG through the same artifact pipeline and logs the unavailable reason. Screenshot URLs are limited to localhost/127.x/::1 targets until a stronger remote access policy exists.

Notifications:

```text
notification service
  -> notifications table
  -> REST list/test/read APIs
  -> optional Socket.IO notification:created event
  -> future Web Push/OAuth delivery
```

MVP notification delivery is DB-backed and local UI-visible. It is not Web Push yet.

## Security Boundary

- Server validates every REST and Socket request.
- Token hashes are stored, never plaintext tokens.
- API token plaintext is returned only once at creation; token list responses expose metadata only.
- Workspace paths are resolved and checked before file operations.
- Artifact downloads resolve through artifact IDs, not arbitrary paths.
- Default bind address is localhost; LAN exposure is explicit config.
- OAuth is reserved for later and must not weaken local token auth.

## Technology Stack Decision

- Web: Next.js, React, TypeScript, TailwindCSS, shadcn/ui-compatible component structure.
- Client data: React Query for REST state and Socket.IO client for live events.
- Server: Node.js daemon, Fastify-style REST boundary, Socket.IO.
- Persistence: SQLite first, repository layer shaped for PostgreSQL later.
- Runtime: Node child processes, Git CLI, file watcher, browser screenshot runner.
- Package manager: pnpm workspace.

## Framework Best-Practice Contract

- TypeScript strict mode.
- Shared DTOs from `packages/core`.
- SQLite schema via migrations, not ad hoc table creation in services.
- React Query for REST state and Socket.IO for live events.
- shadcn/ui/Tailwind conventions for UI, but only after the MVP layout exists.
- Avoid adding dependencies until a built-in or already-installed tool is insufficient.

## Forbidden Paths

Do not:

- Create a private competing architecture in app-specific code.
- Put Agent child process ownership in `apps/web`.
- Let Socket.IO be the only source of truth.
- Store plaintext tokens.
- Read arbitrary files by client-supplied path.
- Duplicate status enums in UI components or HTTP handlers.
- Preserve rejected MVP non-goals as hidden "soon" routes.
