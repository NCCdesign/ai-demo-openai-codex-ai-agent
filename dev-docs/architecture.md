# AI Agent Console Architecture

## Decision

Use one single recommended architecture: a Next.js PWA front end talks to a separate local Node daemon over REST and Socket.IO. The daemon owns long-running Agent sessions, persistence, logs, screenshots, notifications, and local runtime integration.

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
Web chat input
  -> POST /api/sessions/:id/messages
  -> message service persists user message
  -> agent session service calls AgentAdapter.sendMessage
  -> adapter/runtime emits logs/events
  -> server persists events/logs
  -> Socket.IO broadcasts updates
```

Agent selection:

```text
session.agentId
  -> db agents.type
  -> AgentRegistry.get(type)
  -> AgentAdapter
```

No HTTP route or UI component is allowed to special-case Codex. Codex is one adapter behind the shared SPI.

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
