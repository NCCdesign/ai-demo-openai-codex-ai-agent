import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FileChangeType } from "@aic/core";

const execFileAsync = promisify(execFile);

export interface GitSummary {
  branch: string | null;
  commit: string | null;
  unavailableReason?: string;
}

export interface GitFileChangeSnapshot {
  path: string;
  changeType: FileChangeType;
  oldPath: string | null;
  diff: string | null;
}

export async function getGitSummary(workspacePath: string): Promise<GitSummary> {
  try {
    const [branch, commit] = await Promise.all([
      execGit(workspacePath, ["rev-parse", "--abbrev-ref", "HEAD"]),
      execGit(workspacePath, ["rev-parse", "--short", "HEAD"])
    ]);
    return { branch, commit };
  } catch (error) {
    return {
      branch: null,
      commit: null,
      unavailableReason: error instanceof Error ? error.message : "Git summary unavailable"
    };
  }
}

export async function getGitFileChanges(workspacePath: string): Promise<GitFileChangeSnapshot[]> {
  const status = await execGit(workspacePath, ["status", "--porcelain=v1"]);
  const lines = status.split(/\r?\n/).filter(Boolean);
  const changes: GitFileChangeSnapshot[] = [];

  for (const line of lines) {
    const parsed = parsePorcelainLine(line);
    if (!parsed) {
      continue;
    }
    changes.push({
      ...parsed,
      diff: await getGitDiff(workspacePath, parsed.path, parsed.changeType)
    });
  }

  return changes;
}

export async function getGitDiff(workspacePath: string, filePath: string, changeType?: FileChangeType): Promise<string | null> {
  if (changeType === "deleted") {
    return execGit(workspacePath, ["diff", "--", filePath]);
  }
  const unstaged = await execGit(workspacePath, ["diff", "--", filePath]);
  const staged = await execGit(workspacePath, ["diff", "--cached", "--", filePath]);
  const combined = [staged, unstaged].filter(Boolean).join("\n");
  return combined || null;
}

async function execGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

function parsePorcelainLine(line: string): Omit<GitFileChangeSnapshot, "diff"> | null {
  const status = line.slice(0, 2);
  const rawPath = line.slice(2).trimStart();
  if (!rawPath) {
    return null;
  }

  if (status.includes("R")) {
    const [oldPath, newPath] = rawPath.split(" -> ");
    return newPath ? { path: newPath, oldPath: oldPath ?? null, changeType: "renamed" } : null;
  }

  if (status.includes("D")) {
    return { path: rawPath, oldPath: null, changeType: "deleted" };
  }
  if (status.includes("A") || status === "??") {
    return { path: rawPath, oldPath: null, changeType: "added" };
  }
  return { path: rawPath, oldPath: null, changeType: "modified" };
}
