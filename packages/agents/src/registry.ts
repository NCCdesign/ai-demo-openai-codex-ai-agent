import type { AgentAdapter } from "@aic/core";
import { CodexProcessAgentAdapter } from "./codex-process-agent.js";
import { NoopAgentAdapter } from "./noop-agent.js";

export class AgentRegistry {
  private readonly adapters = new Map<string, AgentAdapter>();

  constructor(adapters: AgentAdapter[] = [new NoopAgentAdapter(), new CodexProcessAgentAdapter()]) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.type, adapter);
    }
  }

  get(type: string): AgentAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new Error(`Agent adapter is not registered: ${type}`);
    }
    return adapter;
  }
}
