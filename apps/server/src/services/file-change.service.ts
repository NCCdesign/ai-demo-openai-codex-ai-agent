import type { FileChange } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import { getGitFileChanges } from "@aic/runtime";

export class FileChangeService {
  constructor(private readonly repo: ConsoleRepository) {}

  async refreshSessionFileChanges(sessionId: string): Promise<FileChange[]> {
    const session = this.repo.findSession(sessionId);
    if (!session) {
      throw new Error(`会话不存在：${sessionId}`);
    }
    const workspace = this.repo.findWorkspace(session.workspaceId);
    if (!workspace) {
      throw new Error(`项目不存在：${session.workspaceId}`);
    }
    try {
      const changes = await getGitFileChanges(workspace.path);
      return this.repo.replaceFileChanges({
        sessionId,
        workspaceId: workspace.id,
        changes
      });
    } catch (error) {
      this.repo.appendLog({
        sessionId,
        stream: "system",
        level: "warn",
        line: error instanceof Error ? `文件修改刷新不可用：${error.message}` : "文件修改刷新不可用"
      });
      return this.repo.replaceFileChanges({
        sessionId,
        workspaceId: workspace.id,
        changes: []
      });
    }
  }

  listSessionFileChanges(sessionId: string): FileChange[] {
    return this.repo.listFileChanges(sessionId);
  }

  getDiff(fileChangeId: string): { id: string; path: string; diff: string | null } {
    const change = this.repo.findFileChange(fileChangeId);
    if (!change) {
      throw new Error(`文件修改记录不存在：${fileChangeId}`);
    }
    return {
      id: change.id,
      path: change.path,
      diff: change.diff
    };
  }
}
