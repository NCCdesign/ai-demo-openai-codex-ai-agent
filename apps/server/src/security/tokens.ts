import { randomBytes } from "node:crypto";

export function createBearerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

