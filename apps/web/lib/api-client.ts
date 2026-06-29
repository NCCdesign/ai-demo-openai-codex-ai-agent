import type {
  Agent,
  Artifact,
  ArtifactsResponse,
  AuthToken,
  AuthTokensResponse,
  AuthLoginResponse,
  CreateAuthTokenResponse,
  CreateMessageRequest,
  DashboardResponse,
  FileChange,
  FileChangesResponse,
  LogsResponse,
  Message,
  MessagesResponse,
  Notification,
  NotificationsResponse,
  LogoutResponse,
  Session,
  SessionDetailResponse,
  SessionListItem,
  SessionsResponse
} from "@aic/core";

const defaultApiPort = "4317";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? inferApiBaseUrl();

function inferApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${defaultApiPort}`;
  }
  return `${window.location.protocol}//${window.location.hostname}:${defaultApiPort}`;
}

export async function getDashboard(token?: string): Promise<DashboardResponse | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/dashboard`, {
      cache: "no-store",
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DashboardResponse;
  } catch {
    return null;
  }
}

export async function loadDashboard(token: string): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>("/api/dashboard", { token });
}

export async function login(email: string, password: string): Promise<AuthLoginResponse> {
  return apiRequest<AuthLoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

export async function logout(token: string): Promise<LogoutResponse> {
  return apiRequest<LogoutResponse>("/api/auth/logout", {
    method: "POST",
    token,
    body: {}
  });
}

export async function listAuthTokens(token: string): Promise<AuthToken[]> {
  const response = await apiRequest<AuthTokensResponse>("/api/auth/tokens", { token });
  return response.tokens;
}

export async function createAuthToken(token: string, input: { name?: string; expiresAt?: string | null }): Promise<CreateAuthTokenResponse> {
  return apiRequest<CreateAuthTokenResponse>("/api/auth/tokens", {
    method: "POST",
    token,
    body: input
  });
}

export async function deleteAuthToken(token: string, tokenId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/api/auth/tokens/${tokenId}`, {
    method: "DELETE",
    token
  });
}

export async function listAgents(token: string): Promise<Agent[]> {
  const response = await apiRequest<{ agents: Agent[] }>("/api/agents", { token });
  return response.agents;
}

export async function createSession(token: string, input: { agentId: string; title?: string }): Promise<Session> {
  const response = await apiRequest<{ session: Session }>("/api/sessions", {
    method: "POST",
    token,
    body: {
      workspaceId: "wks_default",
      agentId: input.agentId,
      title: input.title
    }
  });
  return response.session;
}

export async function listSessions(token: string, limit = 20): Promise<SessionListItem[]> {
  const response = await apiRequest<SessionsResponse>(`/api/sessions?limit=${limit}`, { token });
  return response.sessions;
}

export async function getSession(token: string, sessionId: string): Promise<SessionDetailResponse> {
  return apiRequest<SessionDetailResponse>(`/api/sessions/${sessionId}`, { token });
}

export async function loadSavedOrLatestSession(token: string, savedSessionId: string | null): Promise<SessionDetailResponse | null> {
  if (savedSessionId) {
    try {
      return await getSession(token, savedSessionId);
    } catch {
      // Fall through to the latest persisted session; callers may clear stale local storage.
    }
  }
  const sessions = await listSessions(token, 1);
  if (!sessions[0]) {
    return null;
  }
  return getSession(token, sessions[0].session.id);
}

export async function listMessages(token: string, sessionId: string): Promise<Message[]> {
  const response = await apiRequest<MessagesResponse>(`/api/sessions/${sessionId}/messages`, { token });
  return response.messages;
}

export async function sendMessage(token: string, sessionId: string, input: CreateMessageRequest): Promise<Message> {
  const response = await apiRequest<{ message: Message }>(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    token,
    body: input
  });
  return response.message;
}

export async function stopSession(token: string, sessionId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/api/sessions/${sessionId}/stop`, {
    method: "POST",
    token,
    body: {}
  });
}

export async function listLogs(token: string, sessionId: string, input: { cursor?: number; query?: string } = {}): Promise<LogsResponse> {
  const params = new URLSearchParams();
  if (input.cursor != null) {
    params.set("cursor", String(input.cursor));
  }
  if (input.query) {
    params.set("query", input.query);
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  return apiRequest<LogsResponse>(`/api/sessions/${sessionId}/logs${suffix}`, { token });
}

export async function getLogsDownloadBlobUrl(token: string, sessionId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/logs/download`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return URL.createObjectURL(await response.blob());
}

export async function listFileChanges(token: string, sessionId: string): Promise<FileChange[]> {
  const response = await apiRequest<FileChangesResponse>(`/api/sessions/${sessionId}/file-changes`, { token });
  return response.fileChanges;
}

export async function refreshFileChanges(token: string, sessionId: string): Promise<FileChange[]> {
  const response = await apiRequest<FileChangesResponse>(`/api/sessions/${sessionId}/file-changes/refresh`, {
    method: "POST",
    token,
    body: {}
  });
  return response.fileChanges;
}

export async function getFileChangeDiff(token: string, fileChangeId: string): Promise<{ id: string; path: string; diff: string | null }> {
  return apiRequest<{ id: string; path: string; diff: string | null }>(`/api/file-changes/${fileChangeId}/diff`, { token });
}

export async function listScreenshots(token: string, sessionId: string): Promise<Artifact[]> {
  const response = await apiRequest<ArtifactsResponse>(`/api/sessions/${sessionId}/screenshots`, { token });
  return response.artifacts;
}

export async function createScreenshot(token: string, sessionId: string, url?: string): Promise<Artifact> {
  const response = await apiRequest<{ artifact: Artifact }>(`/api/sessions/${sessionId}/screenshots`, {
    method: "POST",
    token,
    body: { url }
  });
  return response.artifact;
}

export async function getArtifactBlobUrl(token: string, artifactId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/artifacts/${artifactId}`, {
    headers: { authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return URL.createObjectURL(await response.blob());
}

export async function listNotifications(token: string): Promise<Notification[]> {
  const response = await apiRequest<NotificationsResponse>("/api/notifications", { token });
  return response.notifications;
}

export async function createTestNotification(token: string): Promise<Notification> {
  const response = await apiRequest<{ notification: Notification }>("/api/notifications/test", {
    method: "POST",
    token,
    body: {}
  });
  return response.notification;
}

export async function markNotificationDelivered(token: string, notificationId: string): Promise<Notification> {
  const response = await apiRequest<{ notification: Notification }>(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    token,
    body: {}
  });
  return response.notification;
}

async function apiRequest<T>(
  path: string,
  input: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: input.method ?? "GET",
    headers: {
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      ...(input.body ? { "content-type": "application/json" } : {})
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
