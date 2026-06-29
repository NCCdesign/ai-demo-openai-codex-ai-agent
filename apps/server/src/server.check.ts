import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthLoginResponse, CommandResponse, CommandsResponse, LogsResponse, Session } from "@aic/core";

const root = mkdtempSync(join(tmpdir(), "aic-server-check-"));
process.env.AIC_DATABASE_PATH = join(root, "server.sqlite");
process.env.AIC_ARTIFACT_ROOT = join(root, "artifacts");
process.env.AIC_WORKSPACE_PATH = root;
process.env.AIC_TOKEN_SECRET = "server-check-secret";

const { createServer } = await import("./server.js");
const app = await createServer();

try {
  const loginResponse = await app.fastify.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.local", password: "change-me" }
  });
  assert.equal(loginResponse.statusCode, 200);
  const login = loginResponse.json<AuthLoginResponse>();

  const sessionResponse = await app.fastify.inject({
    method: "POST",
    url: "/api/sessions",
    headers: { authorization: `Bearer ${login.token}` },
    payload: { workspaceId: "wks_default", agentId: "agt_noop", title: "Command API check" }
  });
  assert.equal(sessionResponse.statusCode, 200);
  const session = sessionResponse.json<{ session: Session }>().session;

  const createCommandResponse = await app.fastify.inject({
    method: "POST",
    url: "/api/commands",
    headers: { authorization: `Bearer ${login.token}` },
    payload: { type: "agent.continue", sessionId: session.id, source: "api", payload: { text: "Continue" } }
  });
  assert.equal(createCommandResponse.statusCode, 200);
  const command = createCommandResponse.json<CommandResponse>().command;
  assert.equal(command.status, "queued");
  assert.equal(command.sessionId, session.id);
  await waitForCommandStatus(command.id, "completed", login.token);

  const listCommandResponse = await app.fastify.inject({
    method: "GET",
    url: `/api/commands?sessionId=${session.id}`,
    headers: { authorization: `Bearer ${login.token}` }
  });
  assert.equal(listCommandResponse.statusCode, 200);
  assert.equal(listCommandResponse.json<CommandsResponse>().commands[0]?.id, command.id);

  const getCommandResponse = await app.fastify.inject({
    method: "GET",
    url: `/api/commands/${command.id}`,
    headers: { authorization: `Bearer ${login.token}` }
  });
  assert.equal(getCommandResponse.statusCode, 200);
  assert.equal(getCommandResponse.json<CommandResponse>().command.id, command.id);
  assert.equal(getCommandResponse.json<CommandResponse>().command.status, "completed");

  const logsResponse = await app.fastify.inject({
    method: "GET",
    url: `/api/sessions/${session.id}/logs`,
    headers: { authorization: `Bearer ${login.token}` }
  });
  assert.equal(logsResponse.statusCode, 200);
  assert.match(
    logsResponse.json<LogsResponse>().logs.map((log) => log.line).join("\n"),
    /received control command: Continue/
  );

  console.log("server command API check passed");
} finally {
  await app.close();
  rmSync(root, { recursive: true, force: true });
}

async function waitForCommandStatus(commandId: string, status: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.fastify.inject({
      method: "GET",
      url: `/api/commands/${commandId}`,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(response.statusCode, 200);
    const command = response.json<CommandResponse>().command;
    if (command.status === status) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Command ${commandId} did not reach ${status}`);
}
