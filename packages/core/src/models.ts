export type UserRole = "admin" | "operator";

export type AgentType = "codex" | "noop" | "claude" | "gemini" | "gpt";

export type AgentStatus =
  | "idle"
  | "starting"
  | "running"
  | "waiting_for_user"
  | "stopping"
  | "stopped"
  | "failed"
  | "completed";

export type SessionStatus = AgentStatus;

export const agentRuntimeStatuses = [
  "idle",
  "planning",
  "running",
  "waiting",
  "tool_calling",
  "completed",
  "failed",
  "cancelled"
] as const;

export type AgentRuntimeStatus = (typeof agentRuntimeStatuses)[number];

export type AgentRuntimeRecoverPolicy = "none" | "manual" | "restart";

export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export const commandTypes = [
  "agent.continue",
  "agent.pause",
  "agent.resume",
  "agent.stop",
  "agent.cancel",
  "agent.restart",
  "agent.screenshot",
  "workspace.test.run",
  "workspace.deploy.run"
] as const;

export type CommandType = (typeof commandTypes)[number];

export type CommandStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out";

export const commandSources = ["ui", "api", "telegram", "system"] as const;

export type CommandSource = (typeof commandSources)[number];

export type MessageRole = "user" | "assistant" | "system" | "agent";

export type ContentFormat = "markdown" | "plain";

export type LogStream = "stdout" | "stderr" | "agent" | "system";

export type LogLevel = "debug" | "info" | "warn" | "error";

export const agentStreamEventTypes = [
  "token",
  "tool_call",
  "tool_result",
  "progress",
  "error",
  "status_change"
] as const;

export type AgentStreamEventType = (typeof agentStreamEventTypes)[number];

export type FileChangeType = "added" | "modified" | "deleted" | "renamed";

export type ArtifactType = "screenshot" | "log_bundle" | "diff" | "report";

export type NotificationType = "task_completed" | "task_failed" | "waiting_for_user" | "system";

export type NotificationStatus = "pending" | "delivered" | "failed" | "muted";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  id: string;
  userId: string;
  name: string | null;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  defaultBranch: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  agentId: string;
  title: string | null;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  lastError: string | null;
  createdBy: string | null;
}

export interface AgentRuntimeInstance {
  id: string;
  sessionId: string;
  workspaceId: string;
  agentId: string;
  pid: number | null;
  status: AgentRuntimeStatus;
  heartbeatAt: string;
  startedAt: string;
  stoppedAt: string | null;
  lastError: string | null;
  recoverPolicy: AgentRuntimeRecoverPolicy;
}

export interface Task {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface Command {
  id: string;
  type: CommandType;
  status: CommandStatus;
  source: CommandSource;
  sessionId: string;
  workspaceId: string;
  agentId: string;
  userId: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  contentFormat: ContentFormat;
  createdAt: string;
}

export interface LogLine {
  id: number;
  sessionId: string;
  stream: LogStream;
  level: LogLevel | null;
  line: string;
  createdAt: string;
}

export interface AgentStreamEvent {
  id: number;
  sessionId: string;
  type: AgentStreamEventType;
  sequence: number;
  payload: Record<string, unknown>;
  commandId: string | null;
  logId: number | null;
  createdAt: string;
}

export interface FileChange {
  id: string;
  sessionId: string;
  workspaceId: string;
  path: string;
  changeType: FileChangeType;
  oldPath: string | null;
  diff: string | null;
  createdAt: string;
}

export interface Artifact {
  id: string;
  sessionId: string | null;
  type: ArtifactType;
  name: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string | null;
  sessionId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  status: NotificationStatus;
  createdAt: string;
  deliveredAt: string | null;
}
