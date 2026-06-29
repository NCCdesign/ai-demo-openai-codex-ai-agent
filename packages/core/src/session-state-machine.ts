import type { SessionStatus } from "./models.js";

const allowedTransitions: Record<SessionStatus, readonly SessionStatus[]> = {
  idle: ["starting", "stopped"],
  starting: ["running", "waiting_for_user", "failed", "stopping"],
  running: ["waiting_for_user", "stopping", "failed", "completed"],
  waiting_for_user: ["running", "stopping", "failed", "completed"],
  stopping: ["stopped", "failed"],
  stopped: ["starting"],
  failed: ["starting"],
  completed: ["starting"]
} satisfies Record<SessionStatus, SessionStatus[]>;

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionSession(from: SessionStatus, to: SessionStatus): SessionStatus {
  if (!canTransitionSession(from, to)) {
    throw new Error(`Invalid session transition: ${from} -> ${to}`);
  }
  return to;
}

export function getAllowedSessionTransitions(from: SessionStatus): readonly SessionStatus[] {
  return allowedTransitions[from];
}
