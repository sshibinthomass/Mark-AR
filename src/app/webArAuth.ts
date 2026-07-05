export type AuthRole = 'admin' | 'user';
export type AuthStatus = 'active' | 'pending';

export type AuthUser = {
  email: string;
  name?: string;
  role: AuthRole;
  status: AuthStatus;
};

export type AuthSession = {
  user: AuthUser;
  token: string | null;
};

type LoginInput = {
  apiUrl: string;
  email: string;
  password: string;
  fetchImpl?: typeof fetch;
};

type SessionInput = {
  apiUrl: string;
  token: string | null;
  fetchImpl?: typeof fetch;
};

type AuthResponse = {
  user?: AuthUser;
  token?: string;
  error?: string;
};

const authTokenStorageKey = 'mark-ar-web-ar-auth-token';

export async function loginToWebArWorker({
  apiUrl,
  email,
  password,
  fetchImpl = fetch,
}: LoginInput): Promise<AuthSession> {
  const response = await fetchImpl(`${authBaseUrl(apiUrl)}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });
  return parseAuthSessionResponse(response);
}

export async function getCurrentWebArUser({
  apiUrl,
  token,
  fetchImpl = fetch,
}: SessionInput): Promise<AuthUser | null> {
  if (!token) {
    return null;
  }

  const response = await fetchImpl(`${authBaseUrl(apiUrl)}/session`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    return null;
  }
  const body = (await response.json()) as AuthResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `Session failed with HTTP ${response.status}.`);
  }
  if (!body.user) {
    throw new Error('Worker response did not include the current user.');
  }
  return body.user;
}

export function saveWorkerAuthToken(token: string): void {
  window.localStorage.setItem(authTokenStorageKey, token);
}

export function loadWorkerAuthToken(): string | null {
  return window.localStorage.getItem(authTokenStorageKey);
}

export function clearWorkerAuthToken(): void {
  window.localStorage.removeItem(authTokenStorageKey);
}

async function parseAuthSessionResponse(response: Response): Promise<AuthSession> {
  const body = (await response.json()) as AuthResponse;
  if (!response.ok) {
    throw new Error(body.error ?? `Auth request failed with HTTP ${response.status}.`);
  }
  if (!body.user) {
    throw new Error('Worker response did not include a user.');
  }
  return {
    user: body.user,
    token: body.token ?? null,
  };
}

function authBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Worker API URL is not configured.');
  }
  return `${trimmed.replace(/\/generate-3d(?:\/openai)?$/, '')}/auth`;
}
