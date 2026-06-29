import type {
  Agent,
  AgentRuntimeInstance,
  Artifact,
  AuthToken,
  Command,
  CommandSource,
  CommandType,
  ContentFormat,
  FileChange,
  LogLine,
  LogStream,
  Message,
  Notification,
  Session,
  SessionStatus,
  Workspace
} from "./models.js";

export interface ApiError {
  code: string;
  message: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
  };
}

export interface CreateAuthTokenRequest {
  name?: string;
  expiresAt?: string | null;
}

export interface CreateAuthTokenResponse {
  token: string;
  authToken: AuthToken;
}

export interface AuthTokensResponse {
  tokens: AuthToken[];
}

export interface LogoutResponse {
  ok: boolean;
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
}

export interface WorkspaceResponse {
  workspace: Workspace;
}

export interface DashboardResponse {
  currentSession: Session | null;
  status: SessionStatus | "unavailable";
  durationSeconds: number | null;
  system: {
    cpuPercent: number | null;
    memoryPercent: number | null;
    unavailableReason?: string;
  };
  git: {
    branch: string | null;
    commit: string | null;
    unavailableReason?: string;
  };
  recentFiles: FileChange[];
  workspace: Pick<Workspace, "id" | "name" | "path"> | null;
}

export interface CreateSessionRequest {
  workspaceId: string;
  agentId: string;
  title?: string;
}

export interface SessionListItem {
  session: Session;
  agent: Pick<Agent, "id" | "type" | "name" | "enabled">;
  workspace: Pick<Workspace, "id" | "name" | "path">;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface CreateMessageRequest {
  content: string;
  contentFormat?: ContentFormat;
}

export interface CreateCommandRequest {
  type: CommandType;
  sessionId: string;
  source?: CommandSource;
  payload?: Record<string, unknown>;
}

export interface CommandResponse {
  command: Command;
}

export interface CommandsResponse {
  commands: Command[];
}

export interface ListLogsQuery {
  cursor?: number;
  limit?: number;
  query?: string;
  stream?: LogStream;
}

export interface SessionDetailResponse {
  session: Session;
  agent: Agent;
  workspace: Workspace;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface AgentRuntimeResponse {
  runtime: AgentRuntimeInstance;
}

export interface SessionsResponse {
  sessions: SessionListItem[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface LogsResponse {
  logs: LogLine[];
  nextCursor: number | null;
}

export interface FileChangesResponse {
  fileChanges: FileChange[];
}

export interface ArtifactsResponse {
  artifacts: Artifact[];
}

export interface NotificationsResponse {
  notifications: Notification[];
}
