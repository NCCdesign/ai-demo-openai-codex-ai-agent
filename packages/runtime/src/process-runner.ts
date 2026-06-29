import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { execFileSync } from "node:child_process";

export interface ProcessRunnerInput {
  command: string;
  args?: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  closeStdin?: boolean;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  onError?: (error: Error) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  spawnProcess?: typeof spawn;
}

export interface ProcessControlResult {
  ok: boolean;
  error?: string;
}

export interface RunningProcess {
  child: ChildProcessWithoutNullStreams | null;
  startError: Error | null;
  exited: Promise<void>;
  stop: () => ProcessControlResult;
  pause: () => ProcessControlResult;
  resume: () => ProcessControlResult;
  write: (input: string) => void;
}

export function startProcess(input: ProcessRunnerInput): RunningProcess {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = (input.spawnProcess ?? spawn)(input.command, input.args ?? [], {
      cwd: input.cwd,
      env: input.env ?? process.env,
      shell: false
    });
  } catch (error) {
    return {
      child: null,
      startError: error instanceof Error ? error : new Error(String(error)),
      exited: Promise.resolve(),
      stop: () => ({ ok: false, error: "Process did not start." }),
      pause: () => ({ ok: false, error: "Process did not start." }),
      resume: () => ({ ok: false, error: "Process did not start." }),
      write: () => undefined
    };
  }

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");

  let resolveExited!: () => void;
  const exited = new Promise<void>((resolve) => {
    resolveExited = resolve;
  });
  child.stdout.on("data", (chunk) => splitLines(chunk, input.onStdout));
  child.stderr.on("data", (chunk) => splitLines(chunk, input.onStderr));
  child.on("error", (error) => input.onError?.(error));
  child.on("exit", (code, signal) => input.onExit?.(code, signal));
  child.on("close", () => {
    resolveExited();
  });
  if (input.closeStdin) {
    child.stdin.end();
  }

  return {
    child,
    startError: null,
    exited,
    stop: () => stopProcess(child),
    pause: () => pauseProcess(child),
    resume: () => resumeProcess(child),
    write: (value) => child.stdin.write(value)
  };
}

function stopProcess(child: ChildProcessWithoutNullStreams): ProcessControlResult {
  if (!child.pid) {
    return { ok: false, error: "Process pid is unavailable." };
  }
  if (process.platform !== "win32") {
    return { ok: child.kill("SIGTERM") };
  }
  return stopWindowsProcessTree(child.pid);
}

function pauseProcess(child: ChildProcessWithoutNullStreams): ProcessControlResult {
  if (!child.pid) {
    return { ok: false, error: "Process pid is unavailable." };
  }
  if (process.platform !== "win32") {
    return { ok: child.kill("SIGSTOP") };
  }
  return runWindowsThreadControl(child.pid, "Suspend");
}

function resumeProcess(child: ChildProcessWithoutNullStreams): ProcessControlResult {
  if (!child.pid) {
    return { ok: false, error: "Process pid is unavailable." };
  }
  if (process.platform !== "win32") {
    return { ok: child.kill("SIGCONT") };
  }
  return runWindowsThreadControl(child.pid, "Resume");
}

function stopWindowsProcessTree(pid: number): ProcessControlResult {
  const script = `
$ErrorActionPreference = 'Stop'
Get-Process -Id ${pid} | Out-Null
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$queue = New-Object 'System.Collections.Generic.Queue[int]'
$pids = New-Object 'System.Collections.Generic.List[int]'
$queue.Enqueue(${pid})
while ($queue.Count -gt 0) {
  $current = $queue.Dequeue()
  $pids.Add($current)
  foreach ($child in $all | Where-Object { $_.ParentProcessId -eq $current }) {
    $queue.Enqueue([int]$child.ProcessId)
  }
}
$targets = $pids.ToArray()
[array]::Reverse($targets)
foreach ($target in $targets) {
  try {
    Stop-Process -Id $target -Force -ErrorAction Stop
  } catch {
    if ($target -eq ${pid}) {
      throw
    }
  }
}
`;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ],
      { windowsHide: true, stdio: "pipe" }
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: processControlError(error)
    };
  }
}

function runWindowsThreadControl(pid: number, method: "Suspend" | "Resume"): ProcessControlResult {
  const script = `
$ErrorActionPreference = 'Stop'
$source = @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class AicProcessControl {
  [DllImport("kernel32.dll")]
  private static extern IntPtr OpenThread(int desiredAccess, bool inheritHandle, uint threadId);
  [DllImport("kernel32.dll")]
  private static extern uint SuspendThread(IntPtr threadHandle);
  [DllImport("kernel32.dll")]
  private static extern int ResumeThread(IntPtr threadHandle);
  [DllImport("kernel32.dll")]
  private static extern bool CloseHandle(IntPtr handle);

  private const int THREAD_SUSPEND_RESUME = 0x0002;

  public static void Apply(int pid, bool resume) {
    Process process = Process.GetProcessById(pid);
    foreach (ProcessThread thread in process.Threads) {
      IntPtr handle = OpenThread(THREAD_SUSPEND_RESUME, false, (uint)thread.Id);
      if (handle == IntPtr.Zero) {
        continue;
      }
      try {
        if (resume) {
          ResumeThread(handle);
        } else {
          SuspendThread(handle);
        }
      } finally {
        CloseHandle(handle);
      }
    }
  }
}
"@
Add-Type -TypeDefinition $source
Get-Process -Id ${pid} | Out-Null
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$queue = New-Object 'System.Collections.Generic.Queue[int]'
$pids = New-Object 'System.Collections.Generic.List[int]'
$queue.Enqueue(${pid})
while ($queue.Count -gt 0) {
  $current = $queue.Dequeue()
  $pids.Add($current)
  foreach ($child in $all | Where-Object { $_.ParentProcessId -eq $current }) {
    $queue.Enqueue([int]$child.ProcessId)
  }
}
$targets = $pids.ToArray()
if ('${method}' -eq 'Resume') {
  [array]::Reverse($targets)
}
foreach ($target in $targets) {
  try {
    [AicProcessControl]::Apply($target, ${method === "Resume" ? "$true" : "$false"})
  } catch {
    if ($target -eq ${pid}) {
      throw
    }
  }
}
`;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script
      ],
      { windowsHide: true, stdio: "pipe" }
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: processControlError(error)
    };
  }
}

function processControlError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const details: string[] = [error.message];
  const maybeOutput = error as Error & { stdout?: Buffer | string; stderr?: Buffer | string };
  const stderr = outputText(maybeOutput.stderr);
  const stdout = outputText(maybeOutput.stdout);
  if (stderr) {
    details.push(stderr);
  }
  if (stdout) {
    details.push(stdout);
  }
  return details.join("\n").trim();
}

function outputText(value: Buffer | string | undefined): string | null {
  if (!value) {
    return null;
  }
  const text = Buffer.isBuffer(value) ? value.toString("utf8") : value;
  return text.trim() || null;
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
