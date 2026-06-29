# Implementation Plan

## MVP

Goal: daily usable local control console.

Build order:

1. Project truth and monorepo scaffold.
2. Core domain types, DTOs, and session state machine.
3. SQLite migrations and repositories.
4. Server daemon with config, auth, sessions, messages, logs, dashboard, and socket server.
5. Built-in no-op agent for checks and Codex-compatible process adapter.
6. Web app shell with login, dashboard, chat, logs, files, screenshots, and settings.
7. File change and Git summary services.
8. Screenshot artifact service.
9. PWA manifest and iPhone-first responsive polish.
10. Startup/development documentation.

MVP intentionally postpones plugin marketplace, OAuth, Docker, CI/CD, terminal write access, and cloud hosting.

## Beta

Goal: stable multi-project daily operation.

Add:

- Multiple workspaces.
- Session history and restore.
- Agent configuration page.
- Web Push notification implementation.
- Better log search and virtual scrolling.
- Screenshot automation triggers.
- More complete Git details.
- Read-only terminal view or heavily constrained terminal input.
- Plugin manifest registry.
- Backup/export.

## Formal Release

Goal: extensible local agent platform.

Add:

- Multiple agents in parallel.
- Claude/Gemini/GPT adapters.
- Workflow orchestration.
- File browser.
- Git management.
- Docker management.
- Deploy management.
- Automated test and CI/CD hooks.
- PostgreSQL option.
- OAuth and RBAC.
- Audit logs.
- Plugin sandbox and marketplace.

## Current Stop Condition

This initial run should leave:

- Active project truth docs.
- Monorepo scaffold.
- Core contracts.
- SQLite migration/repository skeleton.
- Server API/socket skeleton.
- Web PWA shell.
- At least one runnable check.

It does not need to fully operate Codex yet unless local CLI integration is safe and discoverable during implementation.

