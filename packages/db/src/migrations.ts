import type { DbClient } from "./client.js";

const migrations = [
  {
    id: "001_initial_schema",
    sql: `
      create table if not exists schema_migrations (
        id text primary key,
        applied_at text not null
      );

      create table if not exists users (
        id text primary key,
        email text unique not null,
        password_hash text not null,
        display_name text,
        role text not null,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists auth_tokens (
        id text primary key,
        user_id text not null,
        token_hash text not null,
        name text,
        expires_at text,
        created_at text not null,
        last_used_at text,
        foreign key (user_id) references users(id) on delete cascade
      );

      create table if not exists workspaces (
        id text primary key,
        name text not null,
        path text not null,
        default_branch text,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists agents (
        id text primary key,
        type text not null,
        name text not null,
        enabled integer not null,
        config_json text,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists sessions (
        id text primary key,
        workspace_id text not null,
        agent_id text not null,
        title text,
        status text not null,
        started_at text,
        ended_at text,
        last_error text,
        created_by text,
        foreign key (workspace_id) references workspaces(id),
        foreign key (agent_id) references agents(id),
        foreign key (created_by) references users(id)
      );

      create table if not exists tasks (
        id text primary key,
        session_id text not null,
        user_id text not null,
        content text not null,
        status text not null,
        created_at text not null,
        completed_at text,
        foreign key (session_id) references sessions(id) on delete cascade,
        foreign key (user_id) references users(id)
      );

      create table if not exists messages (
        id text primary key,
        session_id text not null,
        role text not null,
        content text not null,
        content_format text not null,
        created_at text not null,
        foreign key (session_id) references sessions(id) on delete cascade
      );

      create table if not exists logs (
        id integer primary key autoincrement,
        session_id text not null,
        stream text not null,
        level text,
        line text not null,
        created_at text not null,
        foreign key (session_id) references sessions(id) on delete cascade
      );

      create table if not exists file_changes (
        id text primary key,
        session_id text not null,
        workspace_id text not null,
        path text not null,
        change_type text not null,
        old_path text,
        diff text,
        created_at text not null,
        foreign key (session_id) references sessions(id) on delete cascade,
        foreign key (workspace_id) references workspaces(id)
      );

      create table if not exists artifacts (
        id text primary key,
        session_id text,
        type text not null,
        name text not null,
        file_path text not null,
        mime_type text,
        size_bytes integer,
        created_at text not null,
        foreign key (session_id) references sessions(id) on delete set null
      );

      create table if not exists notifications (
        id text primary key,
        user_id text,
        session_id text,
        type text not null,
        title text not null,
        body text,
        status text not null,
        created_at text not null,
        delivered_at text,
        foreign key (user_id) references users(id) on delete cascade,
        foreign key (session_id) references sessions(id) on delete set null
      );

      create table if not exists events (
        id integer primary key autoincrement,
        session_id text,
        type text not null,
        payload_json text not null,
        created_at text not null,
        foreign key (session_id) references sessions(id) on delete set null
      );

      create index if not exists idx_messages_session_created on messages(session_id, created_at);
      create index if not exists idx_logs_session_id_id on logs(session_id, id);
      create index if not exists idx_file_changes_session_created on file_changes(session_id, created_at);
      create index if not exists idx_artifacts_session_created on artifacts(session_id, created_at);
      create index if not exists idx_events_session_id on events(session_id, id);
    `
  }
];

export function runMigrations(db: DbClient): void {
  db.exec("create table if not exists schema_migrations (id text primary key, applied_at text not null);");
  const hasMigration = db.prepare("select 1 from schema_migrations where id = ?");
  const insertMigration = db.prepare("insert into schema_migrations (id, applied_at) values (?, ?)");

  for (const migration of migrations) {
    if (hasMigration.get(migration.id)) {
      continue;
    }
    db.exec("begin");
    try {
      db.exec(migration.sql);
      insertMigration.run(migration.id, new Date().toISOString());
      db.exec("commit");
    } catch (error) {
      db.exec("rollback");
      throw error;
    }
  }
}
