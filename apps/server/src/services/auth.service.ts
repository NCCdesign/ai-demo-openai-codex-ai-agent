import { randomUUID } from "node:crypto";
import type { DbClient } from "@aic/db";
import type { AuthToken } from "@aic/core";
import { createBearerToken, getBearerToken } from "../security/tokens.js";
import { hashToken, verifyPassword } from "../security/passwords.js";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

export class AuthService {
  constructor(
    private readonly db: DbClient,
    private readonly tokenSecret: string
  ) {}

  login(email: string, password: string): { token: string; user: AuthUser } | null {
    const row = this.db.prepare("select * from users where email = ?").get(email) as UserRow | undefined;
    if (!row || !verifyPassword(password, row.password_hash)) {
      return null;
    }
    const token = createBearerToken();
    this.insertToken({
      token,
      userId: row.id,
      name: "登录",
      expiresAt: null,
      markUsed: true
    });
    return {
      token,
      user: mapUser(row)
    };
  }

  listTokens(userId: string): AuthToken[] {
    return this.db
      .prepare(
        `select id, user_id, name, expires_at, created_at, last_used_at
         from auth_tokens
         where user_id = ?
         order by created_at desc`
      )
      .all(userId)
      .map((row) => mapToken(row as unknown as AuthTokenRow));
  }

  createToken(input: { userId: string; name?: string | null; expiresAt?: string | null }): { token: string; authToken: AuthToken } {
    const token = createBearerToken();
    const authToken = this.insertToken({
      token,
      userId: input.userId,
      name: normalizeTokenName(input.name),
      expiresAt: normalizeExpiresAt(input.expiresAt),
      markUsed: false
    });
    return { token, authToken };
  }

  deleteToken(userId: string, tokenId: string): boolean {
    const result = this.db.prepare("delete from auth_tokens where id = ? and user_id = ?").run(tokenId, userId);
    return result.changes > 0;
  }

  deleteTokenByAuthorization(authorization: string | undefined): boolean {
    const token = getBearerToken(authorization);
    if (!token) {
      return false;
    }
    const result = this.db.prepare("delete from auth_tokens where token_hash = ?").run(hashToken(token, this.tokenSecret));
    return result.changes > 0;
  }

  authenticateHeader(authorization: string | undefined): AuthUser | null {
    const token = getBearerToken(authorization);
    if (!token) {
      return null;
    }
    const tokenHash = hashToken(token, this.tokenSecret);
    const row = this.db
      .prepare(
        `select users.* from auth_tokens
         join users on users.id = auth_tokens.user_id
         where auth_tokens.token_hash = ?`
      )
      .get(tokenHash) as UserRow | undefined;
    if (!row) {
      return null;
    }
    this.db
      .prepare(
        `update auth_tokens
         set last_used_at = ?
         where token_hash = ?
           and (expires_at is null or expires_at > ?)`
      )
      .run(new Date().toISOString(), tokenHash, new Date().toISOString());
    const tokenStillValid = this.db
      .prepare("select 1 from auth_tokens where token_hash = ? and (expires_at is null or expires_at > ?)")
      .get(tokenHash, new Date().toISOString());
    return tokenStillValid ? mapUser(row) : null;
  }

  private insertToken(input: { token: string; userId: string; name: string | null; expiresAt: string | null; markUsed: boolean }): AuthToken {
    const createdAt = new Date().toISOString();
    const authToken: AuthToken = {
      id: `tok_${randomUUID().replaceAll("-", "")}`,
      userId: input.userId,
      name: input.name,
      expiresAt: input.expiresAt,
      createdAt,
      lastUsedAt: input.markUsed ? createdAt : null
    };
    this.db
      .prepare(
        `insert into auth_tokens (id, user_id, token_hash, name, expires_at, created_at, last_used_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(authToken.id, input.userId, hashToken(input.token, this.tokenSecret), authToken.name, authToken.expiresAt, authToken.createdAt, authToken.lastUsedAt);
    return authToken;
  }
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  password_hash: string;
}

interface AuthTokenRow {
  id: string;
  user_id: string;
  name: string | null;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role
  };
}

function mapToken(row: AuthTokenRow): AuthToken {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

function normalizeTokenName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.slice(0, 80) : "访问令牌";
}

function normalizeExpiresAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error("Invalid token expiration timestamp");
  }
  return new Date(timestamp).toISOString();
}
