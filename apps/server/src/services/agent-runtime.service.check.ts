import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConsoleRepository, openDatabase, runMigrations } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AgentRuntimeService } from "./agent-runtime.service.js";

const root = mkdtempSync(join(tmpdir(), "aic-agent-runtime-check-"));
const db = openDatabase(join(root, "runtime.sqlite"));

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
    status: "starting"
  });
  const statusEvents: string[] = [];
  const runtimes = new AgentRuntimeService(repo, (runtime) => statusEvents.push(runtime.status));
  const created = runtimes.createForSession({
    sessionId: session.id,
    workspaceId: session.workspaceId,
    agentId: session.agentId,
    pid: 123,
    sessionStatus: "starting"
  });

  assert.equal(created.status, "planning");
  assert.equal(created.pid, 123);
  assert.equal(created.recoverPolicy, "manual");
  assert.equal(runtimes.findBySession(session.id)?.id, created.id);
  assert.equal(runtimes.listActive()[0]?.id, created.id);

  const heartbeat = runtimes.heartbeat(session.id);
  assert.ok(heartbeat);
  assert.equal(heartbeat.id, created.id);

  const running = runtimes.syncSessionStatus(session.id, "running");
  assert.equal(running?.status, "running");
  assert.equal(running?.pid, 123);
  assert.deepEqual(statusEvents, ["running"]);

  const repeated = runtimes.syncSessionStatus(session.id, "running");
  assert.equal(repeated?.status, "running");
  assert.deepEqual(statusEvents, ["running"]);

  const stopped = runtimes.syncSessionStatus(session.id, "stopped");
  assert.equal(stopped?.status, "cancelled");
  assert.equal(stopped?.pid, null);
  assert.ok(stopped?.stoppedAt);
  assert.deepEqual(statusEvents, ["running", "cancelled"]);
  assert.equal(runtimes.listActive().length, 0);

  const staleSession = repo.createSession({
    workspaceId: "wks_default",
    agentId: "agt_noop",
    createdBy: "usr_admin",
    status: "running"
  });
  repo.createAgentRuntimeInstance({
    sessionId: staleSession.id,
    workspaceId: staleSession.workspaceId,
    agentId: staleSession.agentId,
    status: "running"
  });
  const staleRuntime = runtimes.findBySession(staleSession.id);
  assert.ok(staleRuntime);
  runtimes.startHeartbeat(1);
  await new Promise((resolve) => setTimeout(resolve, 5));
  runtimes.stopHeartbeat();
  assert.equal(runtimes.findBySession(staleSession.id)?.heartbeatAt, staleRuntime.heartbeatAt);

  const recovered = runtimes.reconcileStaleInstances(0);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0]?.status, "failed");
  assert.equal(recovered[0]?.pid, null);
  assert.match(recovered[0]?.lastError ?? "", /Runtime heartbeat stale/);
  assert.equal(runtimes.findBySession(staleSession.id)?.status, "failed");
  assert.deepEqual(statusEvents, ["running", "cancelled", "failed"]);

  console.log("agent runtime service check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
