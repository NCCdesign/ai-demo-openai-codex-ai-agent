import { cpus, freemem, loadavg, totalmem } from "node:os";

export interface SystemMetrics {
  cpuPercent: number | null;
  memoryPercent: number | null;
  unavailableReason?: string;
}

export function getSystemMetrics(): SystemMetrics {
  const total = totalmem();
  const free = freemem();
  const memoryPercent = total > 0 ? round(((total - free) / total) * 100) : null;
  const cpuCount = cpus().length;
  const load = loadavg()[0];
  const cpuPercent = process.platform === "win32" || cpuCount === 0 ? null : round(Math.min(100, (load / cpuCount) * 100));

  return {
    cpuPercent,
    memoryPercent,
    ...(cpuPercent == null ? { unavailableReason: "CPU load percentage is unavailable on this platform." } : {})
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

