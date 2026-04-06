const API_BASE = '/api';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = await res.json();
    accessToken = data.accessToken;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If 401 with TOKEN_EXPIRED, try refresh
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED' || body.code === 'INVALID_REFRESH_TOKEN' || !accessToken) {
      // Deduplicate refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    }
  }

  return res;
}

// Auth API
export async function apiRegister(data: any) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return { ok: res.ok, data: await res.json(), status: res.status };
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });
  const data = await res.json();
  if (res.ok && data.accessToken) {
    accessToken = data.accessToken;
  }
  return { ok: res.ok, data, status: res.status };
}

export async function apiMfaVerify(userId: string, code: string) {
  const res = await fetch(`${API_BASE}/auth/mfa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, code }),
    credentials: 'include',
  });
  const data = await res.json();
  if (res.ok && data.accessToken) {
    accessToken = data.accessToken;
  }
  return { ok: res.ok, data, status: res.status };
}

export async function apiLogout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  accessToken = null;
}

export async function apiVerifyEmail(token: string) {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return { ok: res.ok, data: await res.json() };
}

export async function apiForgotPassword(email: string) {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return { ok: res.ok, data: await res.json() };
}

export async function apiResetPassword(token: string, password: string, confirmPassword: string) {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirmPassword }),
  });
  return { ok: res.ok, data: await res.json() };
}

export function getGoogleAuthUrl(): string {
  // Redirect to backend endpoint which redirects to Google
  return `${API_BASE}/auth/google`;
}

export async function apiCompleteProfile(dateOfBirth: string) {
  const res = await apiFetch('/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify({ dateOfBirth }),
  });
  return { ok: res.ok, data: await res.json() };
}
