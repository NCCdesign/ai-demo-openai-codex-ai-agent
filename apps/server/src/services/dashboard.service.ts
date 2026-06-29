import type { DashboardResponse } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";
import { getGitSummary, getSystemMetrics } from "@aic/runtime";

export class DashboardService {
  constructor(private readonly repo: ConsoleRepository) {}

  async getDashboard(): Promise<DashboardResponse> {
    const latest = this.repo.findLatestSession();
    const workspace = latest ? this.repo.findWorkspace(latest.workspaceId) : this.repo.findWorkspace("wks_default");
    const git = workspace ? await getGitSummary(workspace.path) : { branch: null, commit: null, unavailableReason: "项目尚未配置。" };
    return this.repo.getDashboard({
      system: getSystemMetrics(),
      git
    });
  }
}
