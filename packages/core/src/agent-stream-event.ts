import { agentStreamEventTypes, type AgentStreamEventType } from "./models.js";

export function isAgentStreamEventType(value: unknown): value is AgentStreamEventType {
  return typeof value === "string" && (agentStreamEventTypes as readonly string[]).includes(value);
}

export function describeAgentStreamEvent(type: AgentStreamEventType, payload: Record<string, unknown>): string {
  if (type === "token") {
    return stringValue(payload.text, "Token");
  }
  if (type === "tool_call") {
    return `Tool call: ${stringValue(payload.name, "unknown")}`;
  }
  if (type === "tool_result") {
    return `Tool result: ${stringValue(payload.name, "unknown")}`;
  }
  if (type === "progress") {
    return stringValue(payload.message, "Progress update");
  }
  if (type === "error") {
    return stringValue(payload.message, "Agent error");
  }
  return `Status: ${stringValue(payload.status, "unknown")}`;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
