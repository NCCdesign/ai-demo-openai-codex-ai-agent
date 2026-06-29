import type { AgentStatus, LogLevel, LogStream } from "./models.js";

export interface StartAgentInput {
  sessionId: string;
  workspacePath: string;
  initialPrompt?: string;
  onEvent?: (event: AgentRuntimeEvent) => void;
  onStatus?: (status: AgentStatus) => void;
}

export interface AgentRuntimeEvent {
  sessionId: string;
  stream: LogStream;
  level: LogLevel | null;
  line: string;
  createdAt: string;
}

export interface AgentSessionHandle {
  sessionId: string;
  status: AgentStatus;
  pid?: number | null;
}

export interface AgentAdapter {
  readonly type: string;
  start(input: StartAgentInput): Promise<AgentSessionHandle>;
  sendMessage(sessionId: string, message: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  getStatus(sessionId: string): Promise<AgentStatus>;
}
