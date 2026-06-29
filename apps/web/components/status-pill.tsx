import { clsx } from "clsx";
import { statusLabel } from "../lib/display";

const styles: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  waiting_for_user: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  failed: "bg-red-500/15 text-red-700 dark:text-red-300",
  unavailable: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-300"
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={clsx("inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium", styles[status] ?? styles.unavailable)}>
      {statusLabel(status)}
    </span>
  );
}
