# Acceptance

## Bootstrap Gates

- Root `AGENTS.md` exists and names source truth.
- `dev-docs/README.md` indexes active truth documents.
- Project initiation defines one recommended mainline and first closed loop.
- Architecture defines owner layers and forbidden paths.
- Acceptance defines stop conditions and evidence log.

## Framework Practice Gate

- TypeScript strict mode is enabled.
- Shared contracts live in `packages/core`.
- Server imports core contracts instead of redefining API/status shapes.
- UI imports core contracts instead of redefining API/status shapes.
- Database writes go through `packages/db` repositories.

## Evidence Plan

Docs-only changes:

- Read back changed docs.
- Check `dev-docs/README.md` links active docs.
- Run guardrail script when available.

Code scaffold:

- Package manager install succeeds.
- TypeScript type check or build succeeds for touched packages.
- Core state-machine check runs.

Server/API:

- Auth-required endpoints reject unauthenticated requests.
- Health/dashboard endpoints return structured data.
- Agent Runtime instance is persisted when a session starts and can be read through `GET /api/sessions/:id/runtime`.
- Agent Runtime heartbeat/status are updated through server services, not UI or adapter-private state.
- Agent Runtime startup reconciliation marks stale active runtime rows failed instead of exposing ghost running state after daemon restart.
- Command Worker calls explicit Agent Adapter control methods for pause/resume/stop instead of treating all controls as chat text.
- Telegram Remote Console commands create Command Queue entries and do not directly call Agent adapters.
- Telegram Remote Console rejects non-allowlisted chat IDs.
- Telegram Remote Console receives outbound runtime status, command status, and log notifications without becoming the recovery source of truth.
- Telegram Remote Console `/status` reads persisted Agent Stream events to show current step, current file, and current tool when available.
- Command Queue execution records include session identity, task ID, command text, tool name, start/end timestamps, duration, error, retry count, and exit code when available.
- Agent Stream events are persisted, replayable through REST, broadcast through Socket.IO, and selected stream types can be mirrored to Telegram without duplicating status/log notifications.
- Codex process output can use provider-native JSONL when configured; Tool Call/Tool Result events must come from structured provider items, not arbitrary terminal text.
- Socket handshake validates token.
- Log write and replay works from persistence.

Frontend:

- Next.js build succeeds.
- Mobile navigation and primary pages render.
- No UI page owns core status definitions.

Security:

- Workspace file operations use resolved-path checks.
- Artifact download uses artifact IDs.
- Tokens are hashed in storage.

## Readiness Language

Use precise claims:

- "Docs gate passed" only after docs are read back and indexed.
- "Code gate passed" only after the relevant command passes.
- "API contract path passed" only after route/socket checks run.
- "UI gate passed" only after build and, when practical, browser verification.
- "Production-ready" requires security, runtime, UI, docs, and deployment acceptance.

## Drift Lock

Before closing a phase:

- Product boundary still matches NCC AI OS as a local-first AI development operating system, not a Codex-only dashboard.
- There is one active truth index: `dev-docs/README.md`.
- Status enums are owned by `packages/core`.
- Database schema is owned by `packages/db`.
- Agent vendor details are behind adapters.
- Socket events are not the recovery source of truth.
- Non-goals have not entered MVP.
- Known unavailable data is represented as unavailable, not fake.

## Drift Checklist

- Product boundary remains local-first NCC AI Development OS.
- Non-goals have not entered MVP.
- `dev-docs/README.md` is the one active truth index.
- There is no private competing architecture.
- Contracts are updated before adapters depend on them.
- Verification evidence matches the touched risk surface.

## Stop Conditions

Stop and ask for a product decision before:

- Exposing this console directly to the public internet.
- Adding terminal write access.
- Adding cloud sync.
- Adding OAuth or RBAC.
- Adding a plugin marketplace.
- Letting an Agent operate outside registered workspace boundaries.

The current phase stops after the scaffold compiles, a core behavior check runs, and server/web skeletons are ready for module work.

## Evidence Log

- 2026-06-28: Bootstrap docs created for one recommended mainline: Next.js PWA plus local Node daemon.
- 2026-06-28: Guardrail script passed with bundled Python.
- 2026-06-28: `pnpm check` passed across core, db, runtime, agents, server, and web; core session state-machine check passed.
- 2026-06-28: `pnpm build` passed; Next.js app built dashboard, chat, logs, files, screenshots, and settings routes.
- 2026-06-28: Server smoke passed: `/api/health`, login, create session, send message, and replay logs. No-op agent returned `waiting_for_user`.
- 2026-06-28: Web smoke passed: `/dashboard` returned HTTP 200 from local Next dev server.
- 2026-06-28: Server data path smoke passed: default SQLite files are created under root `data/`, not package-local `apps/server/data/`.
- 2026-06-28: Final local dev smoke passed after build: API `/api/health` returned HTTP 200 and Web `/dashboard` returned HTTP 200 on port 3002.
- 2026-06-28: Codex-compatible process adapter added behind `AgentAdapter`; server now selects adapters from persisted agent type instead of hard-coding no-op.
- 2026-06-28: Adapter smoke passed on port 4320: `/api/agents` returned `codex,noop`; no-op session accepted a message and replayed logs; Codex session recorded structured `Codex process error: spawn EPERM` instead of returning HTTP 500 in the current sandbox.
- 2026-06-28: Web Chat and Logs moved from static placeholders to real local data flow: login stores bearer token locally, Chat can create sessions and send persisted messages, Logs replays session logs over REST and appends live `log:line` events over Socket.IO.
- 2026-06-28: Web flow smoke passed on port 3003 with API port 4321: `/chat`, `/logs`, and `/dashboard` returned HTTP 200; API smoke created a no-op session, persisted one message, and replayed one log.
- 2026-06-28: File changes/Diff MVP path added: runtime Git scanner reads porcelain status and diffs, server exposes refresh/list/diff APIs, Files UI can refresh and inspect diffs, non-Git workspaces degrade to an empty list plus system log.
- 2026-06-28: File changes verification passed: `pnpm check` now includes runtime Git diff self-check with a temporary repository; API refresh on a non-Git workspace returned an empty list plus a system warning log; Web `/files` returned HTTP 200 on port 3005.
- 2026-06-28: Screenshot artifact MVP path added: server exposes screenshot create/list/download APIs, DB persists screenshot artifacts, runtime writes a valid placeholder PNG, and Screenshots UI lists/downloads artifacts through authenticated blob fetch. API smoke created one screenshot artifact and downloaded `image/png`.
- 2026-06-28: Screenshots Web smoke passed after clean dev restart: `/screenshots` returned HTTP 200 on port 3007 with API port 4324.
- 2026-06-28: Dashboard/notification MVP path added: Dashboard API now uses real memory metrics, Git summary with structured unavailable reason, latest session/recent files; notifications support DB-backed list/test/read plus Socket.IO `notification:created`. API smoke on port 4325 verified dashboard, test notification, list, and delivered status; Web `/dashboard` returned HTTP 200 on port 3008.
- 2026-06-28: Dashboard Web smoke passed after clean dev restart: `/dashboard` returned HTTP 200 on port 3009 with API port 4325.
- 2026-06-28: Session restore path added: `GET /api/sessions` and `GET /api/sessions/:id` return DB-backed session summaries/details with agent/workspace data; Chat, Logs, Files, and Screenshots restore saved or latest sessions through REST instead of reconstructing fake session state from local storage.
- 2026-06-28: Session restore verification passed: `pnpm check` and `pnpm build` passed; API smoke on port 4331 logged in, created a no-op session, sent one message, listed sessions, fetched session detail, confirmed `messageCount = 1`, `startedAt` is present, and status is `waiting_for_user`.
- 2026-06-28: Screenshot runtime upgraded to attempt local system Chromium capture before placeholder fallback; screenshot URLs are restricted to localhost/127.x/::1, runtime validates artifact file creation, and fallback logs the concrete unavailable reason.
- 2026-06-28: Screenshot verification passed for safety and artifact continuity: `pnpm check` and `pnpm build` passed; API smoke on port 4333 confirmed non-local URL returns HTTP 400, local screenshot request stores downloadable `image/png`, and current Windows Edge headless failure is represented as a warning fallback log instead of fake success.
- 2026-06-28: Chat Markdown rendering added without a new dependency: messages render paragraphs, lists, inline code, and fenced code blocks with lightweight syntax highlighting through React nodes, not raw HTML. Web typecheck passed.
- 2026-06-28: Web dev script cleanup kept only `dev:any` for alternate ports via the `PORT` environment variable; UI smoke after build returned HTTP 200 for `/chat` on port 3010 with API port 4334.
- 2026-06-28: PWA install metadata completed with manifest icons, Apple touch icon, and Next metadata icon declarations. Web typecheck passed.
- 2026-06-28: Mobile daily-use polish added: Dashboard refreshes every 10 seconds while authenticated, and Logs auto-scroll to the newest visible line. Web typecheck passed.
- 2026-06-28: Server-backed log download added: `GET /api/sessions/:id/logs/download` exports full persisted session logs as authenticated `text/plain`; Logs UI download now uses the server export instead of current visible rows. API smoke on port 4335 confirmed HTTP 200 attachment with two persisted log lines and unauthenticated access returns 401.
- 2026-06-28: API token management added: `GET/POST/DELETE /api/auth/tokens` list metadata, create one-time plaintext bearer tokens, and revoke tokens. Settings UI can create/copy/delete tokens. `pnpm check` now includes an auth token self-check covering create, authenticate, delete, and expired-token rejection. API smoke on port 4336 confirmed new token auth works, deleted token returns 401, and invalid `expiresAt` returns 400.
- 2026-06-28: Chat stop control added: the Chat header now calls `POST /api/sessions/:id/stop` through the shared API client and updates the session status to `stopped`; Web typecheck passed.
- 2026-06-28: Auth logout and read-only workspace APIs added: `POST /api/auth/logout` revokes the current bearer token; `GET /api/workspaces` and `GET /api/workspaces/:id` expose the seeded local workspace without pretending multi-workspace writes exist. API smoke on port 4337 confirmed workspace list/detail, logout success, and post-logout `/api/auth/me` returns 401.
- 2026-06-29: Command Queue baseline added: core command types/state machine, SQLite `commands` and `command_events`, command repository, `POST/GET /api/commands`, and `command:created` Socket event. `pnpm check` and `pnpm build` passed; Fastify inject smoke verified login, no-op session creation, command creation, command listing, and command detail retrieval.
- 2026-06-29: Command worker added for Agent control commands: `agent.continue`, `agent.pause`, `agent.resume`, `agent.stop`, and `agent.cancel` execute through the server worker instead of route-level runtime calls. Worker checks cover pause/resume/stop and explicit failure for unimplemented handlers; server smoke verifies `agent.continue` reaches `completed` and writes an Agent control log. `pnpm check` and `pnpm build` passed.
- 2026-06-29: Legacy-compatible Chat message and Stop routes now create Command Queue entries instead of directly calling Agent adapters. Server smoke verifies `POST /api/sessions/:id/messages` creates and completes an `agent.continue` command, and `POST /api/sessions/:id/stop` creates and completes an `agent.stop` command. `pnpm check` passed; an initial parallel `pnpm check` + `pnpm build` run caused a transient `.next` build race, then sequential `pnpm build` passed.
- 2026-06-29: Agent Runtime instance and heartbeat baseline added: core runtime status contract, SQLite `agent_runtime_instances`, server `AgentRuntimeService`, `GET /api/sessions/:id/runtime`, and `agent_runtime:status_changed` socket contract. Server checks verify runtime create/read/status sync and stop-to-cancelled transition.
- 2026-06-29: Agent Runtime startup reconciliation added: stale active runtime rows older than the heartbeat threshold are marked `failed`, clear `pid`, emit status callbacks, and keep recovery policy manual. This prevents ghost running status after daemon restart; automatic process restart is still future supervisor work.
- 2026-06-29: Command execution audit fields added to `commands`: `task_id`, `command_text`, `tool_name`, `exit_code`, and `duration_ms`. Command responses, stream progress events, and Telegram command notifications now carry the persisted audit context needed for remote debugging.
- 2026-06-29: Agent Adapter control SPI now includes explicit `pause` and `resume` methods. Command Worker checks prove `agent.pause`/`agent.resume` invoke semantic adapter controls rather than `sendMessage`; Codex process pause/resume fails explicitly on unsupported Windows process control instead of reporting fake success.
- 2026-06-29: Telegram `/status` now summarizes persisted Agent Stream context in addition to runtime/log state: current step, current file, and current tool are derived server-side by `RemoteConsoleService`.
- 2026-06-29: Telegram Remote Console baseline added behind allowlisted long polling: `/status` and `/logs` read persisted runtime/log state, `/continue`, `/pause`, `/resume`, and `/stop` create queued commands with `source = telegram`, and fake-client checks verify unauthorized chats are rejected without calling Agent adapters.
- 2026-06-29: Telegram outbound sync added for runtime status, command status, and log lines. Fake-client checks verify allowlisted chats receive outbound updates and disabled Telegram sends nothing.
- 2026-06-29: Structured Agent Stream baseline added: core event contract, SQLite `agent_stream_events`, `AgentStreamService`, `GET /api/sessions/:id/stream`, `agent_stream:event` Socket.IO event, and selected Telegram stream summaries for non-duplicated event types. Server smoke verifies command progress, runtime status, and control logs are replayable from the stream endpoint.
- 2026-06-29: Codex process adapter maps JSONL stdout into core stream drafts for agent messages, command executions, file changes, plan updates, turn status, and errors. Non-JSON stdout remains a log only. The adapter does not yet default to non-interactive `codex exec --json` because long-running Continue/Pause/Resume still needs a dedicated `exec resume` lifecycle.

## Current Phase Acceptance

The current bootstrap/scaffold phase is acceptable when:

- The required docs exist and are indexed.
- The monorepo has installable package manifests.
- Core/session types compile.
- A small runnable check exercises non-trivial session state behavior.
- Server and web have enough structure to continue feature work without changing architecture.
