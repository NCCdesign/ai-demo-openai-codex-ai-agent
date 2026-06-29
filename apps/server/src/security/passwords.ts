import { timingSafeEqual, randomBytes, scryptSync, createHash } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, derived] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !derived) {
    return false;
  }
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(derived, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

