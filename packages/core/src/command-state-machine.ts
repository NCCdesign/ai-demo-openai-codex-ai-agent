import { commandSources, commandTypes, type CommandSource, type CommandStatus, type CommandType } from "./models.js";

const allowedCommandTransitions: Record<CommandStatus, readonly CommandStatus[]> = {
  queued: ["running", "waiting_for_user", "cancelled", "timed_out"],
  running: ["waiting_for_user", "completed", "failed", "cancelled", "timed_out"],
  waiting_for_user: ["queued", "running", "cancelled", "timed_out"],
  completed: [],
  failed: ["queued"],
  cancelled: [],
  timed_out: ["queued"]
} satisfies Record<CommandStatus, CommandStatus[]>;

export function canTransitionCommand(from: CommandStatus, to: CommandStatus): boolean {
  return allowedCommandTransitions[from].includes(to);
}

export function transitionCommand(from: CommandStatus, to: CommandStatus): CommandStatus {
  if (!canTransitionCommand(from, to)) {
    throw new Error(`Invalid command transition: ${from} -> ${to}`);
  }
  return to;
}

export function getAllowedCommandTransitions(from: CommandStatus): readonly CommandStatus[] {
  return allowedCommandTransitions[from];
}

export function isCommandType(value: unknown): value is CommandType {
  return typeof value === "string" && (commandTypes as readonly string[]).includes(value);
}

export function isCommandSource(value: unknown): value is CommandSource {
  return typeof value === "string" && (commandSources as readonly string[]).includes(value);
}
