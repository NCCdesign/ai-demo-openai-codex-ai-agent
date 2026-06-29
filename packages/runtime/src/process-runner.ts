import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface ProcessRunnerInput {
  command: string;
  args?: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onError?: (error: Error) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface RunningProcess {
  child: ChildProcessWithoutNullStreams | null;
  stop: () => void;
  pause: () => boolean;
  resume: () => boolean;
  write: (input: string) => void;
}

export function startProcess(input: ProcessRunnerInput): RunningProcess {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(input.command, input.args ?? [], {
      cwd: input.cwd,
      env: input.env ?? process.env,
      shell: false
    });
  } catch (error) {
    input.onError?.(error instanceof Error ? error : new Error(String(error)));
    return {
      child: null,
      stop: () => undefined,
      pause: () => false,
      resume: () => false,
      write: () => undefined
    };
  }

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  child.stdout.on("data", (chunk) => splitLines(chunk, input.onStdout));
  child.stderr.on("data", (chunk) => splitLines(chunk, input.onStderr));
  child.on("error", (error) => input.onError?.(error));
  child.on("exit", (code, signal) => input.onExit?.(code, signal));

  return {
    child,
    stop: () => child.kill("SIGTERM"),
    // ponytail: SIGSTOP/SIGCONT covers Unix process pause now; upgrade to a Windows job-object/process-tree strategy before claiming cross-platform hard pause.
    pause: () => (process.platform === "win32" ? false : child.kill("SIGSTOP")),
    resume: () => (process.platform === "win32" ? false : child.kill("SIGCONT")),
    write: (value) => child.stdin.write(value)
  };
}

function splitLines(chunk: string, onLine?: (line: string) => void): void {
  if (!onLine) {
    return;
  }
  for (const line of chunk.split(/\r?\n/)) {
    if (line.length > 0) {
      onLine(line);
    }
  }
}
