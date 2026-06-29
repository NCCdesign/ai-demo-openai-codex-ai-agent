import type { AgentStreamEventDraft } from "@aic/core";

export function codexJsonlToStreamEvent(sessionId: string, line: string): AgentStreamEventDraft | null {
  const parsed = parseJsonObject(line);
  if (!parsed) {
    return null;
  }

  const type = stringField(parsed, "type");
  if (type === "error") {
    return draft(sessionId, "error", {
      message: stringField(parsed, "message") ?? "Codex error",
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (type?.startsWith("turn.")) {
    return draft(sessionId, "status_change", {
      status: statusForTurnEvent(type),
      codexEventType: type,
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (type?.startsWith("thread.")) {
    return draft(sessionId, "progress", {
      message: type,
      codexEventType: type,
      source: "codex_jsonl",
      raw: parsed
    });
  }

  const item = objectField(parsed, "item");
  if (!item) {
    return draft(sessionId, "progress", {
      message: type ?? "Codex event",
      codexEventType: type,
      source: "codex_jsonl",
      raw: parsed
    });
  }

  const itemType = stringField(item, "type");
  const text = firstString(item, ["text", "message", "content", "summary"]);
  if (itemType === "agent_message") {
    return draft(sessionId, "token", {
      text: text ?? "Agent message",
      itemType,
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (itemType === "command_execution") {
    return draft(sessionId, "tool_call", {
      name: firstString(item, ["command", "cmd", "name"]) ?? "command_execution",
      itemType,
      status: firstString(item, ["status"]),
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (itemType === "mcp_tool_call") {
    return draft(sessionId, "tool_call", {
      name: firstString(item, ["name", "tool_name", "server"]) ?? "mcp_tool_call",
      itemType,
      status: firstString(item, ["status"]),
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (itemType === "web_search") {
    return draft(sessionId, "tool_call", {
      name: firstString(item, ["query", "name"]) ?? "web_search",
      itemType,
      status: firstString(item, ["status"]),
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (itemType === "file_change") {
    return draft(sessionId, "tool_result", {
      name: firstString(item, ["path", "name"]) ?? "file_change",
      itemType,
      status: firstString(item, ["status"]),
      source: "codex_jsonl",
      raw: parsed
    });
  }
  if (itemType === "plan_update") {
    return draft(sessionId, "progress", {
      message: text ?? "Plan updated",
      itemType,
      source: "codex_jsonl",
      raw: parsed
    });
  }

  return draft(sessionId, "progress", {
    message: itemType ?? type ?? "Codex item",
    itemType,
    codexEventType: type,
    source: "codex_jsonl",
    raw: parsed
  });
}

function draft(sessionId: string, type: AgentStreamEventDraft["type"], payload: Record<string, unknown>): AgentStreamEventDraft {
  return { sessionId, type, payload };
}

function statusForTurnEvent(type: string): string {
  if (type === "turn.started") {
    return "running";
  }
  if (type === "turn.completed") {
    return "completed";
  }
  if (type === "turn.failed") {
    return "failed";
  }
  return "running";
}

function parseJsonObject(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function objectField(input: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = input[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringField(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringField(input, key);
    if (value) {
      return value;
    }
  }
  return null;
}
