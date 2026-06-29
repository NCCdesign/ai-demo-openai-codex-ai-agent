# NCC AI Development OS Project Initiation

## 1. Product Definition

**NCC AI Development OS** (`NCC AI OS`) is a local-first web/PWA operating system for long-running AI development work. It lets the operator inspect task state, chat with the active agent, watch logs, inspect file diffs, view screenshots, and receive future notifications from a phone or desktop browser without using remote desktop.

Target operator: one developer who keeps OpenAI Codex or other AI coding agents running on a personal workstation and wants one durable control plane for AI Agents, projects, GitHub, deployments, logs, monitoring, remote commands, knowledge, and workflows.

One-sentence identity: a secure local AI development operating system for daily mobile supervision and control of development agents and workflows.

The confirmed mainline is:

```text
Next.js PWA UI
  -> authenticated local Node daemon
  -> core contracts + SQLite event store
  -> agent adapters + runtime services
```

## 2. Idea Shaping And Why Build It

The raw need is remote visibility and control while away from the computer. The product mainline is not "a prettier chat UI"; it is a durable control plane for agent sessions, logs, file changes, screenshots, and future tools.

This is the single recommended mainline because it keeps long-running process ownership in one local daemon while allowing the UI, Agent adapters, and future plugins to evolve independently.

Potential leverage: once logs, file changes, screenshots, and commands share a persistent event model, future workflows can be composed from real operation history instead of fragile terminal scraping.

Why build it:

- Remote desktop is heavy and awkward on iPhone.
- Agent terminals are not structured enough for long-running monitoring.
- Chat history, logs, diffs, screenshots, and status need one searchable timeline.
- Future agents need one adapter boundary instead of one bespoke UI per vendor.

The moat for this project is operational continuity: after refresh, network loss, or phone wake/sleep, the console can recover state from persistent events rather than memory-only UI state.

## 3. Goals

First-phase goal: one real closed loop with one workspace, one Codex-compatible agent provider, login, dashboard, chat, logs, file changes, screenshots, and persisted state.

Long-term goal: a plugin-ready local AI Development OS for multiple agents, workflows, terminal, Git, Docker, deploy, testing, CI/CD, remote consoles, knowledge bases, and MCP operations.

The project is real when the developer can leave the workstation, open the PWA on iPhone, see current state/logs, send a command, and later reload without losing messages or event history.

## 4. Non-Goals

Out of MVP:

- Cloud SaaS hosting.
- Multi-tenant collaboration.
- Plugin marketplace.
- Full OAuth.
- Docker management.
- CI/CD orchestration.
- Full terminal write access.
- Autonomous workflow marketplace.

Do not reintroduce these as MVP "small extras" without a product decision.

## 5. First Closed Loop

The first closed loop is:

```text
login
  -> open dashboard
  -> create or inspect one session
  -> send one chat command
  -> persist message/log events
  -> stream logs live
  -> refresh and replay from SQLite
```

This loop proves the product is an operational AI development OS rather than a static mock or Codex-only dashboard.

## 6. Architecture Principles

- One core owner for domain semantics: `packages/core`.
- One persistence owner: `packages/db`.
- One runtime orchestration owner: `apps/server` services backed by `packages/runtime`.
- Thin adapters for Agent vendors.
- Thin UI that renders shared DTOs and sends commands.
- Socket.IO transports events but does not become the source of truth.
- Every important event is persistable or reconstructable from persisted state.
- Security boundaries are server-side: token auth, workspace path checks, request size limits, and no arbitrary filesystem reads.

## 7. First Build Scope

MVP modules:

- Auth with local admin and bearer token.
- Workspace registry with one initial workspace.
- Agent session lifecycle.
- Chat messages persisted as Markdown.
- Log ingestion and replay.
- Dashboard summary.
- Git summary.
- File change tracking and diff retrieval.
- Screenshot artifact storage.
- Socket.IO live updates.
- PWA shell and responsive iPhone-first layout.

First proof abilities:

1. Send a chat command to an agent session and persist both user message and system/agent events.
2. Stream logs over Socket.IO while also allowing refresh-and-replay from SQLite.

## 8. Acceptance

MVP acceptance requires:

- Install/build gates for web and server.
- Core status/state checks.
- Auth-required API and Socket.IO handshake.
- Workspace path traversal guard.
- Log replay after refresh.
- Mobile responsive dashboard/chat/logs screens.
- Documentation write-back for any contract or architecture change.

## 8. Stop Condition

Phase one is complete when:

- A user can log in.
- The dashboard shows a real or structured-unavailable workspace/session status.
- Chat messages persist.
- Logs stream and replay.
- File changes and screenshot artifacts have API/UI surfaces.
- The app can be started locally with documented commands.

Do not claim Beta, multi-agent production readiness, or secure internet exposure until the relevant gates are implemented and verified.
