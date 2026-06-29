import { resolve, relative } from "node:path";

export function assertInsideWorkspace(workspacePath: string, requestedPath: string): string {
  const workspace = resolve(workspacePath);
  const target = resolve(workspace, requestedPath);
  const rel = relative(workspace, target);
  if (rel === "" || (!rel.startsWith("..") && !rel.includes(":"))) {
    return target;
  }
  throw new Error("Path escapes workspace boundary");
}

