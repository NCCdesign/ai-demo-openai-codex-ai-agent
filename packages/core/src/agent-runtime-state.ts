import { agentRuntimeStatuses, type AgentRuntimeStatus, type SessionStatus } from "./models.js";

export function isAgentRuntimeStatus(value: unknown): value is AgentRuntimeStatus {
  return typeof value === "string" && (agentRuntimeStatuses as readonly string[]).includes(value);
}

export function mapSessionStatusToRuntimeStatus(status: SessionStatus): AgentRuntimeStatus {
  switch (status) {
    case "idle":
      return "idle";
    case "starting":
      return "planning";
    case "running":
      return "running";
    case "waiting_for_user":
      return "waiting";
    case "stopping":
    case "stopped":
      return "cancelled";
    case "failed":
      return "failed";
    case "completed":
      return "completed";
  }
}
