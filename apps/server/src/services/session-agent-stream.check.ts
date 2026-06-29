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

class FailingStartAgentAdapter implements AgentAdapter {
  readonly type = "codex";

  async start(input: StartAgentInput): Promise<AgentSessionHandle> {
    input.onStatus?.("failed");
    input.onEvent?.({
      sessionId: input.sessionId,
      stream: "system",
      level: "error",
      line: "Codex process unavailable: Access is denied",
      createdAt: new Date().toISOString()
    });
    input.onStreamEvent?.({
      sessionId: input.sessionId,
      type: "error",
      payload: { message: "Codex process unavailable: Access is denied" }
    });
    return { sessionId: input.sessionId, status: "failed", pid: null, lastError: "Codex process unavailable: Access is denied" };
  }

  async sendMessage(): Promise<void> {}

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}

  async stop(): Promise<void> {}

  async getStatus(): Promise<AgentSessionHandle["status"]> {
    return "failed";
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

  const failingSessions = new SessionService(
    repo,
    new AgentRegistry([new StreamAgentAdapter(), new FailingStartAgentAdapter()]),
    runtimes,
    undefined,
    (event) => streams.appendDraft(event)
  );
  const failedSession = await failingSessions.createSession({
    workspaceId: "wks_default",
    agentId: "agt_codex",
    userId: "usr_admin",
    title: "Failed Codex check"
  });
  assert.equal(failedSession.status, "failed");
  assert.equal(repo.findSession(failedSession.id)?.status, "failed");
  assert.match(repo.findSession(failedSession.id)?.lastError ?? "", /Access is denied/);
  assert.equal(runtimes.findBySession(failedSession.id)?.status, "failed");
  assert.match(runtimes.findBySession(failedSession.id)?.lastError ?? "", /Access is denied/);
  assert.equal(streams.list({ sessionId: failedSession.id }).events.at(-1)?.type, "error");

  console.log("session agent stream check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
