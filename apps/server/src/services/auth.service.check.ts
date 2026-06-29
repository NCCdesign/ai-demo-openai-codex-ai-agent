import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, runMigrations, ConsoleRepository } from "@aic/db";
import { hashPassword } from "../security/passwords.js";
import { AuthService } from "./auth.service.js";

const root = mkdtempSync(join(tmpdir(), "aic-auth-check-"));
const db = openDatabase(join(root, "auth.sqlite"));

try {
  runMigrations(db);
  new ConsoleRepository(db).seedDevelopmentData({
    email: "admin@example.local",
    passwordHash: hashPassword("change-me"),
    workspacePath: root
  });

  const auth = new AuthService(db, "test-secret");
  const login = auth.login("admin@example.local", "change-me");
  if (!login) {
    throw new Error("Expected login to succeed");
  }

  const created = auth.createToken({ userId: login.user.id, name: "Check token" });
  if (!auth.authenticateHeader(`Bearer ${created.token}`)) {
    throw new Error("Expected created token to authenticate");
  }
  if (!auth.deleteToken(login.user.id, created.authToken.id)) {
    throw new Error("Expected token deletion to report success");
  }
  if (auth.authenticateHeader(`Bearer ${created.token}`)) {
    throw new Error("Expected deleted token to stop authenticating");
  }

  const expired = auth.createToken({ userId: login.user.id, name: "Expired", expiresAt: "2000-01-01T00:00:00.000Z" });
  if (auth.authenticateHeader(`Bearer ${expired.token}`)) {
    throw new Error("Expected expired token to be rejected");
  }

  console.log("auth token check passed");
} finally {
  db.close();
  rmSync(root, { recursive: true, force: true });
}
