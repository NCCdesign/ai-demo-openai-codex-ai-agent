# AI Agent Console Dev Docs

This directory is the internal source of truth for the project. Read this index before modifying architecture, API contracts, schema, runtime behavior, or UI workflows.

## Active Documents

- [Project Initiation](project-initiation.md): product boundary, goals, non-goals, first closed loop, stop condition.
- [Architecture](architecture.md): owner layers, dependency direction, module responsibilities, runtime boundaries.
- [API Contract](api-contract.md): REST and Socket.IO contracts.
- [Database Schema](database-schema.md): SQLite-first persistence model and migration expectations.
- [Implementation Plan](implementation-plan.md): staged build order from MVP to Beta and formal release.
- [Acceptance](acceptance.md): verification gates, readiness language, drift lock.

## External Docs

- [Local Development](../docs/local-development.md): install, run, and check commands for local use.

## Source Priority

1. Current code, schema, migrations, tests, logs, and command output.
2. Root `AGENTS.md`.
3. This index and active docs linked above.
4. Archived or historical docs, if any, as context only.

## Archive Rule

One-off plans and completed audits must move to `dev-docs/archive/` or be marked absorbed in the active document that replaced them. Do not leave parallel active plans.
