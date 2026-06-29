# NCC AI Development OS Agent Constitution

This repository builds **NCC AI Development OS** (`NCC AI OS`), a long-lived local-first AI development operating system. Future agents must treat `dev-docs/README.md` as the active project truth index before changing code.

Guardrail markers: 架构优先, 设计优先, 真源, 停止条件, 用户明确否定的概念必须删除, 立项期临时宪法, 禁止选项剧场, 框架, 验收.

## Working Mode

- Default language for project discussion and internal docs is Chinese unless the user asks for English.
- Architecture first, then code. Do not start from UI, HTTP handlers, prompts, or one-off scripts.
- Follow the ponytail rule: lazy means efficient, not careless. Prefer deletion, reuse, standard library, platform features, and already-installed dependencies before writing new code.
- No abstractions that are not buying a real boundary today.
- No second source of truth for status, schema, auth, Agent lifecycle, logs, or file access.
- If a shortcut is intentional and has a known ceiling, mark it in code with `ponytail:` and name the upgrade path.

## Source Order

When sources conflict, use this order:

1. Current code, tests, schema, migrations, runtime logs, and command output.
2. This `AGENTS.md`.
3. `dev-docs/README.md` and linked active docs.
4. User instructions in the current thread.
5. Older notes, drafts, or generated artifacts as history only.

## Product Boundary

The product is a local-first AI development operating system for monitoring and controlling long-running coding agents, projects, logs, deployment hooks, notifications, and automation workflows from mobile and desktop browsers.

OpenAI Codex is only the first Agent Provider. The architecture must stay provider-neutral so Claude, Gemini, GPT, local models, GitHub, Vercel, Docker, Telegram, WeChat, MCP, knowledge bases, and workflows can be added through platform modules or plugins later.

The product is not:

- A cloud SaaS control plane.
- A remote desktop replacement.
- A general chat clone.
- A Codex-only dashboard.
- A plugin marketplace in the first phase.
- A tool that exposes arbitrary filesystem or shell access without explicit server-side boundaries.

## Architecture Rules

- `packages/core` owns domain contracts, status enums, DTOs, and state machines.
- `packages/db` owns persistence and migrations.
- `apps/server` owns authenticated API, Socket.IO, Agent sessions, logs, artifacts, and local runtime orchestration.
- `packages/agents` owns Agent Adapter implementations behind the shared SPI.
- `packages/runtime` owns platform operations such as child processes, Git, file watching, metrics, and browser screenshots.
- `apps/web` owns presentation, PWA, responsive UI, and client-side API/socket bindings only.
- UI and HTTP routes must not invent core status semantics.
- Agent adapters must not own database schema, auth policy, or cross-agent lifecycle semantics.

## Verification Rules

- Non-trivial logic needs one runnable check: a small test, script, or build gate that fails if the logic breaks.
- Frontend changes require at least a build gate; visual/interaction changes should be checked in browser when practical.
- API/socket/schema changes require contract-level checks or focused tests.
- Security-sensitive changes require path-boundary, auth, or token behavior checks.
- Never claim production-ready until build, integration, UI, docs, and remaining risks are all closed.

## Git And File Hygiene

- Do not revert user changes unless explicitly asked.
- Do not use destructive git commands.
- Stage explicit paths only if committing.
- Keep internal design truth in `dev-docs/`.
- Put only user-facing deployment/API/operation docs in `docs/` when that directory exists.
