import { randomUUID } from "node:crypto";
import type { SQLInputValue } from "node:sqlite";
import type { DashboardResponse, LogsResponse, SessionDetailResponse, SessionListItem } from "@aic/core";
import { transitionCommand, type Agent, type Artifact, type ArtifactType, type Command, type CommandSource, type CommandStatus, type CommandType, type ContentFormat, type FileChange, type FileChangeType, type LogLevel, type LogLine, type LogStream, type Message, type Notification, type NotificationStatus, type NotificationType, type Session, type SessionStatus, type Workspace } from "@aic/core";
import type { DbClient } from "./client.js";

const now = () => new Date().toISOString();

const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

export interface SeedInput {
  email: string;
  passwordHash: string;
  workspacePath: string;
}

export class ConsoleRepository {
  constructor(private readonly db: DbClient) {}

  seedDevelopmentData(input: SeedInput): void {
    const createdAt = now();
    this.db
      .prepare(
        `insert or ignore into users (id, email, password_hash, display_name, role, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .run("usr_admin", input.email, input.passwordHash, "管理员", "admin", createdAt, createdAt);

    this.db
      .prepare(
        `insert or ignore into workspaces (id, name, path, default_branch, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?)`
      )
      .run("wks_default", "默认项目", input.workspacePath, null, createdAt, createdAt);

    this.db
      .prepare(
        `insert or ignore into agents (id, type, name, enabled, config_json, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .run("agt_noop", "noop", "空跑 Agent", 1, "{}", createdAt, createdAt);

    this.db
      .prepare(
        `insert or ignore into agents (id, type, name, enabled, config_json, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .run("agt_codex", "codex", "Codex 命令行", 1, "{}", createdAt, createdAt);
  }

  findLatestSession(): Session | null {
    // ponytail: rowid is the MVP recency source because sessions lack created_at; add a created_at column before supporting import/rewrite migrations.
    const row = this.db.prepare("select * from sessions order by rowid desc limit 1").get();
    return row ? mapSession(row as unknown as SessionRow) : null;
  }

  findSession(sessionId: string): Session | null {
    const row = this.db.prepare("select * from sessions where id = ?").get(sessionId);
    return row ? mapSession(row as unknown as SessionRow) : null;
  }

  listSessionSummaries(limit = 20): SessionListItem[] {
    const parsedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 20;
    const boundedLimit = Math.min(Math.max(parsedLimit, 1), 100);
    const rows = this.db
      .prepare(
        `select
           s.*,
           a.id as agent_id_joined,
           a.type as agent_type,
           a.name as agent_name,
           a.enabled as agent_enabled,
           w.id as workspace_id_joined,
           w.name as workspace_name,
           w.path as workspace_path,
           count(m.id) as message_count,
           max(m.created_at) as last_message_at
         from sessions s
         join agents a on a.id = s.agent_id
         join workspaces w on w.id = s.workspace_id
         left join messages m on m.session_id = s.id
         group by s.id
         order by s.rowid desc
         limit ?`
      )
      .all(boundedLimit) as unknown as SessionSummaryRow[];
    return rows.map(mapSessionSummary);
  }

  findSessionDetail(sessionId: string): SessionDetailResponse | null {
    const row = this.db
      .prepare(
        `select
           s.*,
           a.id as agent_id_joined,
           a.type as agent_type,
           a.name as agent_name,
           a.enabled as agent_enabled,
           a.config_json as agent_config_json,
           a.created_at as agent_created_at,
           a.updated_at as agent_updated_at,
           w.id as workspace_id_joined,
           w.name as workspace_name,
           w.path as workspace_path,
           w.default_branch as workspace_default_branch,
           w.created_at as workspace_created_at,
           w.updated_at as workspace_updated_at,
           count(m.id) as message_count,
           max(m.created_at) as last_message_at
         from sessions s
         join agents a on a.id = s.agent_id
         join workspaces w on w.id = s.workspace_id
         left join messages m on m.session_id = s.id
         where s.id = ?
         group by s.id`
      )
      .get(sessionId) as unknown as SessionDetailRow | undefined;
    return row ? mapSessionDetail(row) : null;
  }

  findAgent(agentId: string): Agent | null {
    const row = this.db.prepare("select * from agents where id = ? and enabled = 1").get(agentId);
    return row ? mapAgent(row as unknown as AgentRow) : null;
  }

  listAgents(): Agent[] {
    return this.db
      .prepare("select * from agents order by name asc")
      .all()
      .map((row) => mapAgent(row as unknown as AgentRow));
  }

  findWorkspace(workspaceId: string): Workspace | null {
    const row = this.db.prepare("select * from workspaces where id = ?").get(workspaceId);
    return row ? mapWorkspace(row as unknown as WorkspaceRow) : null;
  }

  listWorkspaces(): Workspace[] {
    return this.db
      .prepare("select * from workspaces order by name asc")
      .all()
      .map((row) => mapWorkspace(row as unknown as WorkspaceRow));
  }

  createSession(input: {
    workspaceId: string;
    agentId: string;
    title?: string | null;
    createdBy?: string | null;
    status?: SessionStatus;
  }): Session {
    const startedAt = now();
    const session: Session = {
      id: id("ses"),
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      title: input.title ?? null,
      status: input.status ?? "idle",
      startedAt,
      endedAt: null,
      lastError: null,
      createdBy: input.createdBy ?? null
    };
    this.db
      .prepare(
        `insert into sessions (id, workspace_id, agent_id, title, status, started_at, ended_at, last_error, created_by)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.id,
        session.workspaceId,
        session.agentId,
        session.title,
        session.status,
        session.startedAt,
        session.endedAt,
        session.lastError,
        session.createdBy
      );
    return session;
  }

  updateSessionStatus(sessionId: string, status: SessionStatus, lastError: string | null = null): void {
    const endedAt = ["stopped", "failed", "completed"].includes(status) ? now() : null;
    this.db
      .prepare(
        `update sessions
         set status = ?, last_error = coalesce(?, last_error), ended_at = coalesce(?, ended_at)
         where id = ?`
      )
      .run(status, lastError, endedAt, sessionId);
  }

  createMessage(input: {
    sessionId: string;
    role: Message["role"];
    content: string;
    contentFormat?: ContentFormat;
  }): Message {
    const message: Message = {
      id: id("msg"),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      contentFormat: input.contentFormat ?? "markdown",
      createdAt: now()
    };
    this.db
      .prepare(
        `insert into messages (id, session_id, role, content, content_format, created_at)
         values (?, ?, ?, ?, ?, ?)`
      )
      .run(message.id, message.sessionId, message.role, message.content, message.contentFormat, message.createdAt);
    return message;
  }

  createCommand(input: {
    type: CommandType;
    source: CommandSource;
    sessionId: string;
    workspaceId: string;
    agentId: string;
    userId: string | null;
    payload?: Record<string, unknown>;
  }): Command {
    const command: Command = {
      id: id("cmd"),
      type: input.type,
      status: "queued",
      source: input.source,
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      payload: input.payload ?? {},
      result: null,
      errorCode: null,
      errorMessage: null,
      retryCount: 0,
      createdAt: now(),
      startedAt: null,
      completedAt: null
    };
    this.db
      .prepare(
        `insert into commands (
          id, type, status, source, session_id, workspace_id, agent_id, user_id,
          payload_json, result_json, error_code, error_message, retry_count,
          created_at, started_at, completed_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        command.id,
        command.type,
        command.status,
        command.source,
        command.sessionId,
        command.workspaceId,
        command.agentId,
        command.userId,
        JSON.stringify(command.payload),
        null,
        null,
        null,
        command.retryCount,
        command.createdAt,
        command.startedAt,
        command.completedAt
      );
    this.appendCommandEvent(command.id, "command.created", { status: command.status, type: command.type });
    return command;
  }

  findCommand(commandId: string): Command | null {
    const row = this.db.prepare("select * from commands where id = ?").get(commandId);
    return row ? mapCommand(row as unknown as CommandRow) : null;
  }

  findNextQueuedCommand(): Command | null {
    const row = this.db.prepare("select * from commands where status = ? order by created_at asc limit 1").get("queued");
    return row ? mapCommand(row as unknown as CommandRow) : null;
  }

  listCommands(input: { sessionId?: string; status?: CommandStatus; limit?: number } = {}): Command[] {
    const parsedLimit = Number.isFinite(input.limit) ? Math.trunc(input.limit ?? 50) : 50;
    const boundedLimit = Math.min(Math.max(parsedLimit, 1), 200);
    const clauses: string[] = [];
    const params: SQLInputValue[] = [];
    if (input.sessionId) {
      clauses.push("session_id = ?");
      params.push(input.sessionId);
    }
    if (input.status) {
      clauses.push("status = ?");
      params.push(input.status);
    }
    params.push(boundedLimit);
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const rows = this.db
      .prepare(`select * from commands ${where} order by created_at desc limit ?`)
      .all(...params) as unknown as CommandRow[];
    return rows.map(mapCommand);
  }

  appendCommandEvent(commandId: string, type: string, payload: Record<string, unknown>): void {
    this.db
      .prepare("insert into command_events (command_id, type, payload_json, created_at) values (?, ?, ?, ?)")
      .run(commandId, type, JSON.stringify(payload), now());
  }

  updateCommandStatus(
    commandId: string,
    status: CommandStatus,
    input: {
      result?: Record<string, unknown> | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      incrementRetry?: boolean;
    } = {}
  ): Command {
    const current = this.findCommand(commandId);
    if (!current) {
      throw new Error(`Command does not exist: ${commandId}`);
    }
    transitionCommand(current.status, status);
    const startedAt = status === "running" && !current.startedAt ? now() : current.startedAt;
    const completedAt = ["completed", "failed", "cancelled", "timed_out"].includes(status) ? now() : current.completedAt;
    const retryCount = current.retryCount + (input.incrementRetry ? 1 : 0);
    this.db
      .prepare(
        `update commands
         set status = ?,
             result_json = ?,
             error_code = ?,
             error_message = ?,
             retry_count = ?,
             started_at = ?,
             completed_at = ?
         where id = ?`
      )
      .run(
        status,
        input.result === undefined ? (current.result ? JSON.stringify(current.result) : null) : input.result ? JSON.stringify(input.result) : null,
        input.errorCode === undefined ? current.errorCode : input.errorCode,
        input.errorMessage === undefined ? current.errorMessage : input.errorMessage,
        retryCount,
        startedAt,
        completedAt,
        commandId
      );
    const updated = this.findCommand(commandId);
    if (!updated) {
      throw new Error(`Command disappeared after update: ${commandId}`);
    }
    this.appendCommandEvent(commandId, "command.status_changed", {
      from: current.status,
      to: status,
      errorCode: updated.errorCode,
      errorMessage: updated.errorMessage
    });
    return updated;
  }

  listMessages(sessionId: string): Message[] {
    return this.db
      .prepare("select * from messages where session_id = ? order by created_at asc")
      .all(sessionId)
      .map((row) => mapMessage(row as unknown as MessageRow));
  }

  appendLog(input: {
    sessionId: string;
    stream: LogStream;
    level: LogLevel | null;
    line: string;
  }): LogLine {
    const createdAt = now();
    const result = this.db
      .prepare("insert into logs (session_id, stream, level, line, created_at) values (?, ?, ?, ?, ?)")
      .run(input.sessionId, input.stream, input.level, input.line, createdAt);
    return {
      id: Number(result.lastInsertRowid),
      sessionId: input.sessionId,
      stream: input.stream,
      level: input.level,
      line: input.line,
      createdAt
    };
  }

  listLogs(sessionId: string, cursor = 0, limit = 500, query?: string, stream?: LogStream): LogsResponse {
    const boundedLimit = Math.min(Math.max(limit, 1), 2000);
    const clauses = ["session_id = ?", "id > ?"];
    const params: SQLInputValue[] = [sessionId, cursor];
    if (query) {
      clauses.push("line like ?");
      params.push(`%${query}%`);
    }
    if (stream) {
      clauses.push("stream = ?");
      params.push(stream);
    }
    params.push(boundedLimit);
    const rows = this.db
      .prepare(`select * from logs where ${clauses.join(" and ")} order by id asc limit ?`)
      .all(...params) as unknown as LogRow[];
    const logs = rows.map(mapLog);
    return {
      logs,
      nextCursor: logs.length ? logs[logs.length - 1]!.id : null
    };
  }

  exportLogsText(sessionId: string): string {
    const rows = this.db
      .prepare("select * from logs where session_id = ? order by id asc")
      .all(sessionId) as unknown as LogRow[];
    return rows
      .map((row) => {
        const level = row.level ? ` [${row.level}]` : "";
        return `[${row.created_at}] [${row.stream}]${level} ${row.line}`;
      })
      .join("\n");
  }

  replaceFileChanges(input: {
    sessionId: string;
    workspaceId: string;
    changes: Array<{
      path: string;
      changeType: FileChangeType;
      oldPath: string | null;
      diff: string | null;
    }>;
  }): FileChange[] {
    const createdAt = now();
    this.db.prepare("delete from file_changes where session_id = ?").run(input.sessionId);
    const insert = this.db.prepare(
      `insert into file_changes (id, session_id, workspace_id, path, change_type, old_path, diff, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const changes = input.changes.map((change) => ({
      id: id("fch"),
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      path: change.path,
      changeType: change.changeType,
      oldPath: change.oldPath,
      diff: change.diff,
      createdAt
    }));
    this.db.exec("begin");
    try {
      for (const change of changes) {
        insert.run(change.id, change.sessionId, change.workspaceId, change.path, change.changeType, change.oldPath, change.diff, change.createdAt);
      }
      this.db.exec("commit");
    } catch (error) {
      this.db.exec("rollback");
      throw error;
    }
    return changes;
  }

  listFileChanges(sessionId: string): FileChange[] {
    return this.db
      .prepare("select * from file_changes where session_id = ? order by created_at desc, path asc")
      .all(sessionId)
      .map((row) => mapFileChange(row as unknown as FileChangeRow));
  }

  findFileChange(fileChangeId: string): FileChange | null {
    const row = this.db.prepare("select * from file_changes where id = ?").get(fileChangeId);
    return row ? mapFileChange(row as unknown as FileChangeRow) : null;
  }

  createArtifact(input: {
    sessionId: string | null;
    type: ArtifactType;
    name: string;
    filePath: string;
    mimeType: string | null;
    sizeBytes: number | null;
  }): Artifact {
    const artifact: Artifact = {
      id: id("art"),
      sessionId: input.sessionId,
      type: input.type,
      name: input.name,
      filePath: input.filePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: now()
    };
    this.db
      .prepare(
        `insert into artifacts (id, session_id, type, name, file_path, mime_type, size_bytes, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(artifact.id, artifact.sessionId, artifact.type, artifact.name, artifact.filePath, artifact.mimeType, artifact.sizeBytes, artifact.createdAt);
    return artifact;
  }

  listArtifacts(sessionId: string, type?: ArtifactType): Artifact[] {
    const rows = type
      ? this.db.prepare("select * from artifacts where session_id = ? and type = ? order by created_at desc").all(sessionId, type)
      : this.db.prepare("select * from artifacts where session_id = ? order by created_at desc").all(sessionId);
    return rows.map((row) => mapArtifact(row as unknown as ArtifactRow));
  }

  findArtifact(artifactId: string): Artifact | null {
    const row = this.db.prepare("select * from artifacts where id = ?").get(artifactId);
    return row ? mapArtifact(row as unknown as ArtifactRow) : null;
  }

  createNotification(input: {
    userId: string | null;
    sessionId: string | null;
    type: NotificationType;
    title: string;
    body?: string | null;
    status?: NotificationStatus;
  }): Notification {
    const notification: Notification = {
      id: id("ntf"),
      userId: input.userId,
      sessionId: input.sessionId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      status: input.status ?? "pending",
      createdAt: now(),
      deliveredAt: null
    };
    this.db
      .prepare(
        `insert into notifications (id, user_id, session_id, type, title, body, status, created_at, delivered_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(notification.id, notification.userId, notification.sessionId, notification.type, notification.title, notification.body, notification.status, notification.createdAt, notification.deliveredAt);
    return notification;
  }

  listNotifications(userId: string | null, limit = 50): Notification[] {
    const boundedLimit = Math.min(Math.max(limit, 1), 200);
    const rows = userId
      ? this.db.prepare("select * from notifications where user_id is null or user_id = ? order by created_at desc limit ?").all(userId, boundedLimit)
      : this.db.prepare("select * from notifications order by created_at desc limit ?").all(boundedLimit);
    return rows.map((row) => mapNotification(row as unknown as NotificationRow));
  }

  markNotificationDelivered(notificationId: string): Notification | null {
    const deliveredAt = now();
    this.db.prepare("update notifications set status = ?, delivered_at = ? where id = ?").run("delivered", deliveredAt, notificationId);
    const row = this.db.prepare("select * from notifications where id = ?").get(notificationId);
    return row ? mapNotification(row as unknown as NotificationRow) : null;
  }

  getDashboard(input?: {
    system?: DashboardResponse["system"];
    git?: DashboardResponse["git"];
  }): DashboardResponse {
    const session = this.findLatestSession();
    const workspace = session ? this.findWorkspace(session.workspaceId) : this.findWorkspace("wks_default");
    return {
      currentSession: session,
      status: session?.status ?? "unavailable",
      durationSeconds: session?.startedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(session.startedAt)) / 1000)) : null,
      system: input?.system ?? {
        cpuPercent: null,
        memoryPercent: null,
        unavailableReason: "系统指标服务尚未接入。"
      },
      git: input?.git ?? {
        branch: null,
        commit: null,
        unavailableReason: "Git 摘要服务尚未接入。"
      },
      recentFiles: session ? this.listFileChanges(session.id).slice(0, 8) : [],
      workspace: workspace ? { id: workspace.id, name: workspace.name, path: workspace.path } : null
    };
  }
}

interface SessionRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  title: string | null;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  last_error: string | null;
  created_by: string | null;
}

interface SessionSummaryRow extends SessionRow {
  agent_id_joined: string;
  agent_type: Agent["type"];
  agent_name: string;
  agent_enabled: number;
  workspace_id_joined: string;
  workspace_name: string;
  workspace_path: string;
  message_count: number;
  last_message_at: string | null;
}

interface SessionDetailRow extends SessionSummaryRow {
  agent_config_json: string | null;
  agent_created_at: string;
  agent_updated_at: string;
  workspace_default_branch: string | null;
  workspace_created_at: string;
  workspace_updated_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  path: string;
  default_branch: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  id: string;
  type: Agent["type"];
  name: string;
  enabled: number;
  config_json: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: Message["role"];
  content: string;
  content_format: ContentFormat;
  created_at: string;
}

interface CommandRow {
  id: string;
  type: CommandType;
  status: CommandStatus;
  source: CommandSource;
  session_id: string;
  workspace_id: string;
  agent_id: string;
  user_id: string | null;
  payload_json: string;
  result_json: string | null;
  error_code: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface LogRow {
  id: number;
  session_id: string;
  stream: LogStream;
  level: LogLevel | null;
  line: string;
  created_at: string;
}

interface FileChangeRow {
  id: string;
  session_id: string;
  workspace_id: string;
  path: string;
  change_type: FileChangeType;
  old_path: string | null;
  diff: string | null;
  created_at: string;
}

interface ArtifactRow {
  id: string;
  session_id: string | null;
  type: ArtifactType;
  name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

interface NotificationRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  status: NotificationStatus;
  created_at: string;
  delivered_at: string | null;
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    lastError: row.last_error,
    createdBy: row.created_by
  };
}

function mapSessionSummary(row: SessionSummaryRow): SessionListItem {
  return {
    session: mapSession(row),
    agent: {
      id: row.agent_id_joined,
      type: row.agent_type,
      name: row.agent_name,
      enabled: row.agent_enabled === 1
    },
    workspace: {
      id: row.workspace_id_joined,
      name: row.workspace_name,
      path: row.workspace_path
    },
    messageCount: Number(row.message_count),
    lastMessageAt: row.last_message_at
  };
}

function mapSessionDetail(row: SessionDetailRow): SessionDetailResponse {
  return {
    session: mapSession(row),
    agent: {
      id: row.agent_id_joined,
      type: row.agent_type,
      name: row.agent_name,
      enabled: row.agent_enabled === 1,
      config: row.agent_config_json ? (JSON.parse(row.agent_config_json) as Record<string, unknown>) : {},
      createdAt: row.agent_created_at,
      updatedAt: row.agent_updated_at
    },
    workspace: {
      id: row.workspace_id_joined,
      name: row.workspace_name,
      path: row.workspace_path,
      defaultBranch: row.workspace_default_branch,
      createdAt: row.workspace_created_at,
      updatedAt: row.workspace_updated_at
    },
    messageCount: Number(row.message_count),
    lastMessageAt: row.last_message_at
  };
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    defaultBranch: row.default_branch,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    enabled: row.enabled === 1,
    config: row.config_json ? (JSON.parse(row.config_json) as Record<string, unknown>) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    contentFormat: row.content_format,
    createdAt: row.created_at
  };
}

function mapCommand(row: CommandRow): Command {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    source: row.source,
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    userId: row.user_id,
    payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    result: row.result_json ? (JSON.parse(row.result_json) as Record<string, unknown>) : null,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at
  };
}

function mapLog(row: LogRow): LogLine {
  return {
    id: row.id,
    sessionId: row.session_id,
    stream: row.stream,
    level: row.level,
    line: row.line,
    createdAt: row.created_at
  };
}

function mapFileChange(row: FileChangeRow): FileChange {
  return {
    id: row.id,
    sessionId: row.session_id,
    workspaceId: row.workspace_id,
    path: row.path,
    changeType: row.change_type,
    oldPath: row.old_path,
    diff: row.diff,
    createdAt: row.created_at
  };
}

function mapArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    name: row.name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at
  };
}
