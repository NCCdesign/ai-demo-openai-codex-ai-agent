import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentAdapter, AgentSessionHandle, StartAgentInput } from "@aic/core";
import { AgentRegistry } from "@aic/agents";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AgentRuntimeService } from "./agent-runtime.service.js";
import { AgentStreamService } from "./agent-stream.service.js";
import { SessionService } from "./session.service.js";

class StreamAgentAdapter implements AgentAdapter {
  readonly type = "noop";

  async start(input: StartAgentInput): Promise<AgentSessionHandle> {
    input.onStreamEvent?.({
      sessionId: input.sessionId,
      type: "tool_call",
      payload: { name: "git status" }
    });
    return { sessionId: input.sessionId, status: "running" };
  }

  async sendMessage(): Promise<void> {}

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}

  async stop(): Promise<void> {}

  async getStatus(): Promise<AgentSessionHandle["status"]> {
    return "running";
  }
}

const root = mkdtempSync(join(tmpdir(), "aic-session-stream-check-"));
const db = openDatabase(join(root, "session-stream.sqlite"));

try {
  runMigrations(db);
  const repo = new ConsoleRepository(db);
  repo.seedDevelopmentData({
    email: "admin@example.local",
    passwordHash: hashPassword("change-me"),
    workspacePath: root
  });
  const runtimes = new AgentRuntimeService(repo);
  const streams = new AgentStreamService(repo);
  const sessions = new SessionService(repo, new AgentRegistry([new StreamAgentAdapter()]), runtimes, undefined, (event) => streams.appendDraft(event));
  const session = await sessions.createSession({
    workspaceId: "wks_default",
    agentId: "agt_noop",
    userId: "usr_admin",
    title: "Session stream check"
  });

  const events = streams.list({ sessionId: session.id }).events;
  assert.equal(events[0]?.type, "tool_call");
  assert.equal(events[0]?.payload.name, "git status");

  console.log("session agent stream check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
