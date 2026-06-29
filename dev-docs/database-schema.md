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
  payload_json text not null,
  result_json text,
  error_code text,
  error_message text,
  retry_count integer not null,
  created_at text not null,
  started_at text,
  completed_at text
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

Agent Runtime:

```text
idle | planning | running | waiting | tool_calling | completed | failed | cancelled
```

Agent Runtime recover policy:

```text
none | manual | restart
```

`agent_runtime_instances.session_id` is unique. The runtime row is the durable source for remote status views and recovery preparation; adapter in-memory handles are not recovery truth.

## Migration Rules

- Migrations live in `packages/db/src/migrations`.
- Repository methods are the only write path from services to tables.
- Do not create tables inside HTTP handlers or UI code.
- Schema changes require updating this document and at least one relevant check.
