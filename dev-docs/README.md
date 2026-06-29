# NCC AI Development OS Dev Docs

This directory is the internal source of truth for the project. Read this index before modifying architecture, API contracts, schema, runtime behavior, or UI workflows.

Product naming update: the long-term product name is **NCC AI Development OS**, abbreviated **NCC AI OS**. Older references to `AI Agent Console` describe the MVP-era scope and must not narrow future architecture back to a Codex-only dashboard.

## Active Documents

- [Project Initiation](project-initiation.md): product boundary, goals, non-goals, first closed loop, stop condition.
- [Architecture](architecture.md): owner layers, dependency direction, module responsibilities, runtime boundaries.
- [API Contract](api-contract.md): REST and Socket.IO contracts.
- [Database Schema](database-schema.md): SQLite-first persistence model and migration expectations.
- [Implementation Plan](implementation-plan.md): staged build order from MVP to Beta and formal release.
- [Acceptance](acceptance.md): verification gates, readiness language, drift lock.

## Production Architecture Review

- [Executive Summary](review/EXECUTIVE_SUMMARY.md): final production architecture review conclusion and next priorities.
- [Project Review](review/PROJECT_REVIEW.md): product positioning, architecture scores, current stage, core risk list.
- [Project Structure Review](review/PROJECT_STRUCTURE_REVIEW.md): directory/module coupling review and recommended structure.
- [Agent Architecture](review/AGENT_ARCHITECTURE.md): Agent runtime, multi-agent/workspace/session design review.
- [Chat System Review](review/CHAT_SYSTEM_REVIEW.md): Agent Conversation, history, streaming, tool call, attachment and memory direction.
- [Dashboard Review](review/DASHBOARD_REVIEW.md): operations-center dashboard review and future information architecture.
- [Command Queue Design](review/COMMAND_QUEUE_DESIGN.md): unified command model for continue, stop, screenshot, deploy, test and plugins.
- [API Review](review/API_REVIEW.md): REST, Socket.IO, streaming and queue boundary review.
- [Realtime Architecture](review/REALTIME_ARCHITECTURE.md): WebSocket-first realtime design, reconnection and recovery model.
- [Logging Plan](review/LOGGING_PLAN.md): agent/system/server/command/terminal logging, rotation and retention plan.
- [Observability](review/OBSERVABILITY.md): health checks, metrics, dashboard monitoring and alert design.
- [Security Review](review/SECURITY_REVIEW.md): Critical/High/Medium/Low security risk review and hardening plan.
- [Deployment Plan](review/DEPLOYMENT_PLAN.md): Windows, Linux, Docker, Compose, Tunnel, HTTPS, auto-restart and backup plan.
- [Plugin Architecture](review/PLUGIN_ARCHITECTURE.md): plugin manifest, capability, permission, registry and MCP/integration design.
- [Project Roadmap](review/PROJECT_ROADMAP.md): Sprint 1 through production release roadmap.

## External Docs

- [Local Development](../docs/local-development.md): install, run, and check commands for local use.

## Source Priority

1. Current code, schema, migrations, tests, logs, and command output.
2. Root `AGENTS.md`.
3. This index and active docs linked above.
4. Archived or historical docs, if any, as context only.

## Archive Rule

One-off plans and completed audits must move to `dev-docs/archive/` or be marked absorbed in the active document that replaced them. Do not leave parallel active plans.
