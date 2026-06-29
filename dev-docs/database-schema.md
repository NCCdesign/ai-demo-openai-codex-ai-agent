# Database Schema

SQLite is the MVP database. Schema choices should stay friendly to a future PostgreSQL migration: text IDs, explicit timestamps, JSON stored as text, and repository boundaries.

## Tables

```sql
users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  display_name text,
  role text not null,
  created_at text not null,
  updated_at text not null
);

auth_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null,
  name text,
  expires_at text,
  created_at text not null,
  last_used_at text
);

workspaces (
  id text primary key,
  name text not null,
  path text not null,
  default_branch text,
  created_at text not null,
  updated_at text not null
);

agents (
  id text primary key,
  type text not null,
  name text not null,
  enabled integer not null,
  config_json text,
  created_at text not null,
  updated_at text not null
);

sessions (
  id text primary key,
  workspace_id text not null,
  agent_id text not null,
  title text,
  status text not null,
  started_at text,
  ended_at text,
  last_error text,
  created_by text
);

agent_runtime_instances (
  id text primary key,
  session_id text not null,
  workspace_id text not null,
  agent_id text not null,
  pid integer,
  status text not null,
  heartbeat_at text not null,
  started_at text not null,
  stopped_at text,
  last_error text,
  recover_policy text not null
);

tasks (
  id text primary key,
  session_id text not null,
  user_id text not null,
  content text not null,
  status text not null,
  created_at text not null,
  completed_at text
);

messages (
  id text primary key,
  session_id text not null,
  role text not null,
  content text not null,
  content_format text not null,
  created_at text not null
);

logs (
  id integer primary key autoincrement,
  session_id text not null,
  stream text not null,
  level text,
  line text not null,
  created_at text not null
);

agent_stream_events (
  id integer primary key autoincrement,
  session_id text not null,
  type text not null,
  sequence integer not null,
  payload_json text not null,
  command_id text,
  log_id integer,
  created_at text not null
);

file_changes (
  id text primary key,
  session_id text not null,
  workspace_id text not null,
  path text not null,
  change_type text not null,
  old_path text,
  diff text,
  created_at text not null
);

artifacts (
  id text primary key,
  session_id text,
  type text not null,
  name text not null,
  file_path text not null,
  mime_type text,
  size_bytes integer,
  created_at text not null
);

notifications (
  id text primary key,
  user_id text,
  session_id text,
  type text not null,
  title text not null,
  body text,
  status text not null,
  created_at text not null,
  delivered_at text
);

events (
  id integer primary key autoincrement,
  session_id text,
  type text not null,
  payload_json text not null,
  created_at text not null
);

commands (
  id text primary key,
  type text not null,
  status text not null,
  source text not null,
  session_id text not null,
  workspace_id text not null,
  agent_id text not null,
  user_id text,
  task_id text,
  command_text text,
  tool_name text,
  payload_json text not null,
  result_json text,
  error_code text,
  error_message text,
  exit_code integer,
  retry_count integer not null,
  created_at text not null,
  started_at text,
  completed_at text,
  duration_ms integer
);

command_events (
  id integer primary key autoincrement,
  command_id text not null,
  type text not null,
  payload_json text not null,
  created_at text not null
);
```

## Status Values

Session:

```text
idle | starting | running | waiting_for_user | stopping | stopped | failed | completed
```

Task:

```text
queued | running | completed | failed | cancelled
```

Log stream:

```text
stdout | stderr | agent | system
```

File change:

```text
added | modified | deleted | renamed
```

Notification:

```text
pending | delivered | failed | muted
```

Command:

```text
queued | running | waiting_for_user | completed | failed | cancelled | timed_out
```

Command source:

```text
ui | api | telegram | system
```

Each command row is also the current execution audit record. It must keep session/workspace/agent identity, a stable `task_id`, normalized `command_text`, `tool_name`, start/end timestamps, `duration_ms`, error fields, retry count, and `exit_code` when the executor can determine one. Future multi-attempt retries may split this into `command_attempts`, but the MVP must not drop audit fields from command responses or stream events.

Agent Runtime:

```text
idle | planning | running | waiting | tool_calling | completed | failed | cancelled
```

Agent Runtime recover policy:

```text
none | manual | restart
```

`agent_runtime_instances.session_id` is unique. The runtime row is the durable source for remote status views and recovery preparation; adapter in-memory handles are not recovery truth.

`agent_runtime_instances.pid` is the current provider child process id when the adapter has reported one. Active states may retain it so remote consoles can distinguish a live process from queued/waiting metadata. Terminal states (`completed`, `failed`, `cancelled`) clear it to `null`; a non-null `pid` must not be treated as historical audit data.

`agent.restart` reuses the same `sessions.id` and `agent_runtime_instances.session_id`. A successful restart clears stale `sessions.ended_at`, `sessions.last_error`, `agent_runtime_instances.stopped_at`, and `agent_runtime_instances.last_error`, then stores the new runtime status and `pid`. A failed restart leaves the session/runtime in `failed` with the latest error reason.

Agent Stream event:

```text
token | tool_call | tool_result | progress | error | status_change
```

`agent_stream_events.sequence` is unique per session. `id` is the REST replay cursor; `sequence` is the session-local display/order value. `command_id` and `log_id` link stream events back to the command/log source when available.

## Migration Rules

- Migrations live in `packages/db/src/migrations`.
- Repository methods are the only write path from services to tables.
- Do not create tables inside HTTP handlers or UI code.
- Schema changes require updating this document and at least one relevant check.
