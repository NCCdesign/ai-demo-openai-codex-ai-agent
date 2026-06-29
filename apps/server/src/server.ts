import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { isCommandSource, isCommandType, type Command } from "@aic/core";
import { AgentRegistry } from "@aic/agents";
import { openDatabase, runMigrations, ConsoleRepository } from "@aic/db";
import { loadConfig } from "./config/env.js";
import { hashPassword } from "./security/passwords.js";
import { AuthService } from "./services/auth.service.js";
import { SessionService } from "./services/session.service.js";
import { FileChangeService } from "./services/file-change.service.js";
import { ScreenshotService } from "./services/screenshot.service.js";
import { DashboardService } from "./services/dashboard.service.js";
import { NotificationService } from "./services/notification.service.js";
import { CommandService } from "./services/command.service.js";
import { CommandWorker } from "./services/command-worker.js";
import { AgentRuntimeService } from "./services/agent-runtime.service.js";
import { RemoteConsoleService } from "./services/remote-console.service.js";
import { TelegramRemoteConsole } from "./remote/telegram-remote-console.js";
import { attachSocketServer } from "./socket/socket-server.js";

export async function createServer() {
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  runMigrations(db);

  const repo = new ConsoleRepository(db);
  repo.seedDevelopmentData({
    email: config.adminEmail,
    passwordHash: hashPassword(config.adminPassword),
    workspacePath: config.workspacePath
  });

  const app = fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });

  const auth = new AuthService(db, config.tokenSecret);
  const io = attachSocketServer(app, auth);
  const dashboard = new DashboardService(repo);
  const notifications = new NotificationService(repo);
  const commands = new CommandService(repo);
  let telegram: TelegramRemoteConsole | null = null;
  const notifyTelegram = (send: (telegramConsole: TelegramRemoteConsole) => Promise<void>) => {
    if (!telegram) {
      return;
    }
    void send(telegram).catch((error) => {
      app.log.warn({ error }, "telegram notification failed");
    });
  };
  const runtimes = new AgentRuntimeService(repo, (runtime) => {
    io.to(`session:${runtime.sessionId}`).emit("agent_runtime:status_changed", {
      type: "agent_runtime:status_changed",
      runtime,
      createdAt: new Date().toISOString()
    });
    notifyTelegram((telegramConsole) => telegramConsole.notifyRuntimeStatus(runtime));
  });
  const fileChanges = new FileChangeService(repo);
  const screenshots = new ScreenshotService(repo, config.artifactRoot);
  const sessions = new SessionService(repo, new AgentRegistry(), runtimes, (log) => {
    io.to(`session:${log.sessionId}`).emit("log:line", {
      type: "log:line",
      log,
      createdAt: new Date().toISOString()
    });
    notifyTelegram((telegramConsole) => telegramConsole.notifyLogLine(log));
  });
  const commandWorker = new CommandWorker(repo, sessions, (command) => {
    io.to(`session:${command.sessionId}`).emit("command:status_changed", {
      type: "command:status_changed",
      command,
      createdAt: new Date().toISOString()
    });
    notifyTelegram((telegramConsole) => telegramConsole.notifyCommandStatus(command));
  });
  const publishCommandCreated = (command: Command) => {
    io.to(`session:${command.sessionId}`).emit("command:created", {
      type: "command:created",
      command,
      createdAt: new Date().toISOString()
    });
    notifyTelegram((telegramConsole) => telegramConsole.notifyCommandStatus(command));
    commandWorker.wake();
  };
  const remoteConsole = new RemoteConsoleService(repo, runtimes, commands, publishCommandCreated);
  telegram = new TelegramRemoteConsole(config.telegram, remoteConsole);

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/api/auth/login" || request.url === "/api/health") {
      return;
    }
    const user = auth.authenticateHeader(request.headers.authorization);
    if (!user) {
      await reply.code(401).send({ code: "unauthorized", message: "需要登录" });
      return;
    }
    request.user = user;
  });

  app.get("/api/health", async () => ({ ok: true }));

  app.post<{ Body: { email: string; password: string } }>("/api/auth/login", async (request, reply) => {
    const result = auth.login(request.body.email, request.body.password);
    if (!result) {
      return reply.code(401).send({ code: "invalid_credentials", message: "邮箱或密码错误" });
    }
    return result;
  });

  app.post("/api/auth/logout", async (request) => ({
    ok: auth.deleteTokenByAuthorization(request.headers.authorization)
  }));

  app.get("/api/auth/me", async (request) => ({ user: request.user }));

  app.get("/api/auth/tokens", async (request) => ({
    tokens: auth.listTokens(request.user.id)
  }));

  app.post<{ Body: { name?: string; expiresAt?: string | null } }>("/api/auth/tokens", async (request, reply) => {
    try {
      const result = auth.createToken({
        userId: request.user.id,
        name: request.body?.name,
        expiresAt: request.body?.expiresAt
      });
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid token expiration timestamp") {
        return reply.code(400).send({ code: "invalid_token_expiration", message: "令牌过期时间无效" });
      }
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/auth/tokens/:id", async (request, reply) => {
    const deleted = auth.deleteToken(request.user.id, request.params.id);
    if (!deleted) {
      return reply.code(404).send({ code: "not_found", message: "令牌不存在" });
    }
    return { ok: true };
  });

  app.get("/api/dashboard", async () => dashboard.getDashboard());

  app.get("/api/workspaces", async () => ({
    workspaces: repo.listWorkspaces()
  }));

  app.get<{ Params: { id: string } }>("/api/workspaces/:id", async (request, reply) => {
    const workspace = repo.findWorkspace(request.params.id);
    if (!workspace) {
      return reply.code(404).send({ code: "not_found", message: "项目不存在" });
    }
    return { workspace };
  });

  app.get("/api/agents", async () => ({ agents: repo.listAgents() }));

  app.get<{ Querystring: { limit?: string } }>("/api/sessions", async (request) => ({
    sessions: repo.listSessionSummaries(Number(request.query.limit ?? 20))
  }));

  app.get<{ Params: { id: string } }>("/api/sessions/:id", async (request, reply) => {
    const detail = repo.findSessionDetail(request.params.id);
    if (!detail) {
      return reply.code(404).send({ code: "not_found", message: "会话不存在" });
    }
    return detail;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/runtime", async (request, reply) => {
    const runtime = runtimes.findBySession(request.params.id);
    if (!runtime) {
      return reply.code(404).send({ code: "not_found", message: "Runtime instance does not exist." });
    }
    return { runtime };
  });

  app.get("/api/notifications", async (request) => ({
    notifications: notifications.listForUser(request.user.id)
  }));

  app.get<{ Querystring: { sessionId?: string; limit?: string } }>("/api/commands", async (request) => ({
    commands: commands.listCommands({
      sessionId: request.query.sessionId,
      limit: Number(request.query.limit ?? 50)
    })
  }));

  app.post<{
    Body: {
      type?: string;
      sessionId?: string;
      source?: "ui" | "api" | "telegram" | "system";
      payload?: Record<string, unknown>;
    };
  }>("/api/commands", async (request, reply) => {
    if (!isCommandType(request.body?.type) || !request.body?.sessionId) {
      return reply.code(400).send({ code: "invalid_command", message: "Command type and sessionId are required." });
    }
    if (request.body.source && !isCommandSource(request.body.source)) {
      return reply.code(400).send({ code: "invalid_command_source", message: "Command source is invalid." });
    }
    const command = commands.createCommand({
      type: request.body.type,
      sessionId: request.body.sessionId,
      source: request.body.source ?? "api",
      userId: request.user.id,
      payload: request.body.payload
    });
    publishCommandCreated(command);
    return { command };
  });

  app.get<{ Params: { id: string } }>("/api/commands/:id", async (request, reply) => {
    const command = commands.getCommand(request.params.id);
    if (!command) {
      return reply.code(404).send({ code: "not_found", message: "Command does not exist." });
    }
    return { command };
  });

  app.post("/api/notifications/test", async (request) => {
    const notification = notifications.createTestNotification(request.user.id);
    io.to(`user:${request.user.id}`).emit("notification:created", {
      type: "notification:created",
      notification: {
        id: notification.id,
        type: notification.type,
        status: notification.status,
        title: notification.title,
        body: notification.body
      },
      createdAt: new Date().toISOString()
    });
    return { notification };
  });

  app.patch<{ Params: { id: string } }>("/api/notifications/:id/read", async (request) => ({
    notification: notifications.markDelivered(request.params.id)
  }));

  app.post<{ Body: { workspaceId?: string; agentId?: string; title?: string } }>("/api/sessions", async (request) => {
    const session = await sessions.createSession({
      workspaceId: request.body.workspaceId ?? "wks_default",
      agentId: request.body.agentId ?? "agt_noop",
      title: request.body.title,
      userId: request.user.id
    });
    io.to(`user:${request.user.id}`).emit("session:created", { type: "session:created", session, createdAt: new Date().toISOString() });
    return { session };
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/messages", async (request) => ({
    messages: repo.listMessages(request.params.id)
  }));

  app.post<{ Params: { id: string }; Body: { content: string; contentFormat?: "markdown" | "plain" } }>(
    "/api/sessions/:id/messages",
    async (request) => {
      const message = sessions.createUserMessage(request.params.id, request.body);
      const command = commands.createCommand({
        type: "agent.continue",
        sessionId: request.params.id,
        source: "api",
        userId: request.user.id,
        payload: { text: request.body.content }
      });
      io.to(`session:${request.params.id}`).emit("message:created", {
        type: "message:created",
        message,
        createdAt: new Date().toISOString()
      });
      publishCommandCreated(command);
      return { message };
    }
  );

  app.post<{ Params: { id: string } }>("/api/sessions/:id/stop", async (request) => {
    const command = commands.createCommand({
      type: "agent.stop",
      sessionId: request.params.id,
      source: "api",
      userId: request.user.id
    });
    publishCommandCreated(command);
    return { ok: true };
  });

  app.get<{ Params: { id: string }; Querystring: { cursor?: string; limit?: string; query?: string; stream?: "stdout" | "stderr" | "agent" | "system" } }>(
    "/api/sessions/:id/logs",
    async (request) =>
      repo.listLogs(
        request.params.id,
        Number(request.query.cursor ?? 0),
        Number(request.query.limit ?? 500),
        request.query.query,
        request.query.stream
      )
  );

  app.get<{ Params: { id: string } }>("/api/sessions/:id/logs/download", async (request, reply) => {
    const session = repo.findSession(request.params.id);
    if (!session) {
      return reply.code(404).send({ code: "not_found", message: "会话不存在" });
    }
    const text = repo.exportLogsText(request.params.id);
    const title = sanitizeDownloadName(session.title ?? session.id);
    reply.header("content-type", "text/plain; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${title}-logs.txt"`);
    return text;
  });

  app.get<{ Params: { id: string } }>("/api/sessions/:id/file-changes", async (request) => ({
    fileChanges: fileChanges.listSessionFileChanges(request.params.id)
  }));

  app.post<{ Params: { id: string } }>("/api/sessions/:id/file-changes/refresh", async (request) => {
    const refreshed = await fileChanges.refreshSessionFileChanges(request.params.id);
    for (const fileChange of refreshed) {
      io.to(`session:${request.params.id}`).emit("file_change:created", {
        type: "file_change:created",
        fileChange,
        createdAt: new Date().toISOString()
      });
    }
    return { fileChanges: refreshed };
  });

  app.get<{ Params: { id: string } }>("/api/file-changes/:id/diff", async (request) => fileChanges.getDiff(request.params.id));

  app.get<{ Params: { id: string } }>("/api/sessions/:id/screenshots", async (request) => ({
    artifacts: screenshots.listScreenshots(request.params.id)
  }));

  app.post<{ Params: { id: string }; Body: { url?: string } }>("/api/sessions/:id/screenshots", async (request, reply) => {
    let artifact;
    try {
      artifact = await screenshots.createScreenshot(request.params.id, request.body?.url);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid screenshot URL:")) {
        return reply.code(400).send({ code: "invalid_screenshot_url", message: error.message });
      }
      throw error;
    }
    io.to(`session:${request.params.id}`).emit("screenshot:created", {
      type: "screenshot:created",
      artifact,
      createdAt: new Date().toISOString()
    });
    return { artifact };
  });

  app.get<{ Params: { id: string } }>("/api/artifacts/:id", async (request, reply) => {
    const result = screenshots.getArtifactStream(request.params.id);
    reply.header("content-type", result.artifact.mimeType ?? "application/octet-stream");
    reply.header("content-length", String(result.sizeBytes));
    return reply.send(result.stream);
  });

  return {
    fastify: app,
    start: async () => {
      runtimes.startHeartbeat();
      commandWorker.start();
      telegram?.start();
      await app.listen({ host: config.host, port: config.port });
    },
    close: async () => {
      telegram?.stop();
      runtimes.stopHeartbeat();
      commandWorker.stop();
      await app.close();
      db.close();
    }
  };
}

function sanitizeDownloadName(value: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || "session";
}

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      displayName: string | null;
      role: string;
    };
  }
}
