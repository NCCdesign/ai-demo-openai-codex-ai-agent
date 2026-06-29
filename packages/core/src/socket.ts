import type {
  Artifact,
  AgentRuntimeInstance,
  AgentStreamEvent,
  Command,
  FileChange,
  LogLine,
  Message,
  NotificationStatus,
  NotificationType,
  Session,
  SessionStatus
} from "./models.js";

export type SocketRoom =
  | `user:${string}`
  | `workspace:${string}`
  | `session:${string}`;

export interface SessionJoinPayload {
  sessionId: string;
}

export interface SendMessagePayload {
  sessionId: string;
  content: string;
}

export type ClientToServerEvent =
  | "session:join"
  | "session:leave"
  | "session:send_message"
  | "session:stop"
  | "logs:subscribe"
  | "logs:unsubscribe"
  | "dashboard:subscribe"
  | "dashboard:unsubscribe";

export type ServerEvent =
  | { type: "dashboard:update"; payload: unknown; createdAt: string }
  | { type: "session:created"; session: Session; createdAt: string }
  | { type: "session:status_changed"; sessionId: string; status: SessionStatus; createdAt: string }
  | { type: "agent_runtime:status_changed"; runtime: AgentRuntimeInstance; createdAt: string }
  | { type: "message:created"; message: Message; createdAt: string }
  | { type: "command:created"; command: Command; createdAt: string }
  | { type: "command:status_changed"; command: Command; createdAt: string }
  | { type: "agent_stream:event"; event: AgentStreamEvent; createdAt: string }
  | { type: "log:line"; log: LogLine; createdAt: string }
  | { type: "file_change:created"; fileChange: FileChange; createdAt: string }
  | { type: "screenshot:created"; artifact: Artifact; createdAt: string }
  | {
      type: "notification:created";
      notification: {
        id: string;
        type: NotificationType;
        status: NotificationStatus;
        title: string;
        body: string | null;
      };
      createdAt: string;
    }
  | { type: "error"; code: string; message: string; createdAt: string };
