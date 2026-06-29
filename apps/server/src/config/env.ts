import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerConfig {
  host: string;
  port: number;
  databasePath: string;
  artifactRoot: string;
  adminEmail: string;
  adminPassword: string;
  tokenSecret: string;
  workspacePath: string;
  telegram: {
    botToken: string | null;
    allowedChatIds: string[];
    pollIntervalMs: number;
    requestTimeoutSeconds: number;
  };
}

export function loadConfig(): ServerConfig {
  const workspaceRoot = findWorkspaceRoot();
  return {
    host: process.env.AIC_HOST ?? "127.0.0.1",
    port: Number(process.env.AIC_SERVER_PORT ?? 4317),
    databasePath: resolve(workspaceRoot, process.env.AIC_DATABASE_PATH ?? "./data/console.sqlite"),
    artifactRoot: resolve(workspaceRoot, process.env.AIC_ARTIFACT_ROOT ?? "./data/artifacts"),
    adminEmail: process.env.AIC_ADMIN_EMAIL ?? "admin@example.local",
    adminPassword: process.env.AIC_ADMIN_PASSWORD ?? "change-me",
    tokenSecret: process.env.AIC_TOKEN_SECRET ?? "change-me-local-secret",
    workspacePath: resolve(process.env.AIC_WORKSPACE_PATH ?? workspaceRoot),
    telegram: {
      botToken: process.env.AIC_TELEGRAM_BOT_TOKEN?.trim() || null,
      allowedChatIds: parseCsv(process.env.AIC_TELEGRAM_ALLOWED_CHAT_IDS),
      pollIntervalMs: numberFromEnv("AIC_TELEGRAM_POLL_INTERVAL_MS", 3000),
      requestTimeoutSeconds: numberFromEnv("AIC_TELEGRAM_REQUEST_TIMEOUT_SECONDS", 20)
    }
  };
}

function parseCsv(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function findWorkspaceRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  while (current !== dirname(current)) {
    if (existsSync(resolve(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    current = dirname(current);
  }
  return process.env.INIT_CWD ? resolve(process.env.INIT_CWD) : process.cwd();
}
