import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AgentStreamService } from "./agent-stream.service.js";

const root = mkdtempSync(join(tmpdir(), "aic-agent-stream-check-"));
const db = openDatabase(join(root, "agent-stream.sqlite"));

try {
  runMigrations(db);
  const repo = new ConsoleRepository(db);
  repo.seedDevelopmentData({
    email: "admin@example.local",
    passwordHash: hashPassword("change-me"),
    workspacePath: root
  });
  const session = repo.createSession({
    workspaceId: "wks_default",
    agentId: "agt_noop",
    createdBy: "usr_admin",
    title: "Agent stream check",
    status: "running"
  });
  const emitted: number[] = [];
  const stream = new AgentStreamService(repo, (event) => emitted.push(event.id));
  const log = repo.appendLog({ sessionId: session.id, stream: "stdout", level: "info", line: "hello" });
  const token = stream.appendLog(log);
  const command = repo.createCommand({
    type: "agent.continue",
    source: "api",
    sessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    userId: "usr_admin",
    payload: {}
  });
  const progress = stream.appendCommand(command);

  assert.equal(token.type, "token");
  assert.equal(token.sequence, 1);
  assert.equal(token.logId, log.id);
  assert.equal(progress.type, "progress");
  assert.equal(progress.sequence, 2);
  assert.deepEqual(emitted, [token.id, progress.id]);
  assert.equal(stream.list({ sessionId: session.id }).events.length, 2);
  assert.equal(stream.list({ sessionId: session.id, cursor: token.id }).events[0]?.id, progress.id);
  assert.equal(stream.list({ sessionId: session.id, cursor: Number.NaN, limit: Number.NaN }).events.length, 2);

  console.log("agent stream service check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
