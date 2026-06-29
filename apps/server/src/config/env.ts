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
    workspacePath: resolve(process.env.AIC_WORKSPACE_PATH ?? workspaceRoot)
  };
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
