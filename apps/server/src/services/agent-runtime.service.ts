import { mapSessionStatusToRuntimeStatus, type AgentRuntimeInstance, type SessionStatus } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";

export class AgentRuntimeService {
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly ownedSessionIds = new Set<string>();

  constructor(
    private readonly repo: ConsoleRepository,
    private readonly onStatusChanged?: (runtime: AgentRuntimeInstance) => void
  ) {}

  createForSession(input: {
    sessionId: string;
    workspaceId: string;
    agentId: string;
    pid?: number | null;
    sessionStatus: SessionStatus;
  }): AgentRuntimeInstance {
    const runtime = this.repo.createAgentRuntimeInstance({
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      pid: input.pid ?? null,
      status: mapSessionStatusToRuntimeStatus(input.sessionStatus),
      recoverPolicy: "manual"
    });
    this.ownedSessionIds.add(input.sessionId);
    return runtime;
  }

  syncSessionStatus(sessionId: string, status: SessionStatus, input: { pid?: number | null; lastError?: string | null } = {}): AgentRuntimeInstance | null {
    const current = this.repo.findAgentRuntimeBySession(sessionId);
    const runtimeStatus = mapSessionStatusToRuntimeStatus(status);
    const terminalInput = ["completed", "failed", "cancelled"].includes(runtimeStatus) && input.pid === undefined ? { ...input, pid: null } : input;
    const updated = this.repo.updateAgentRuntimeStatus(sessionId, runtimeStatus, terminalInput);
    if (updated && current?.status !== updated.status) {
      this.onStatusChanged?.(updated);
    }
    return updated;
  }

  heartbeat(sessionId: string): AgentRuntimeInstance | null {
    return this.repo.updateAgentRuntimeHeartbeat(sessionId);
  }

  findBySession(sessionId: string): AgentRuntimeInstance | null {
    return this.repo.findAgentRuntimeBySession(sessionId);
  }

  listActive(): AgentRuntimeInstance[] {
    return this.repo.listActiveAgentRuntimeInstances();
  }

  reconcileStaleInstances(maxHeartbeatAgeMs = 60_000): AgentRuntimeInstance[] {
    const cutoff = new Date(Date.now() - maxHeartbeatAgeMs).toISOString();
    const staleRuntimes = this.repo
      .listStaleAgentRuntimeInstances(cutoff)
      .filter((runtime) => !this.ownedSessionIds.has(runtime.sessionId));
    const reconciled: AgentRuntimeInstance[] = [];
    for (const runtime of staleRuntimes) {
      const updated = this.repo.updateAgentRuntimeStatus(runtime.sessionId, "failed", {
        pid: null,
        lastError: `Runtime heartbeat stale since ${runtime.heartbeatAt}; manual recovery required.`
      });
      if (updated) {
        reconciled.push(updated);
        this.onStatusChanged?.(updated);
      }
    }
    return reconciled;
  }

  startHeartbeat(intervalMs = 5000): void {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      for (const sessionId of this.ownedSessionIds) {
        const runtime = this.findBySession(sessionId);
        if (!runtime || !["planning", "running", "waiting", "tool_calling"].includes(runtime.status)) {
          this.ownedSessionIds.delete(sessionId);
          continue;
        }
        this.heartbeat(sessionId);
      }
    }, intervalMs);
    this.heartbeatTimer.unref();
  }

  stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}
