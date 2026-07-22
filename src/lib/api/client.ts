export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
}

/**
 * Fetch wrapper for the app's own API. Auth travels in httpOnly cookies, so
 * no token handling is needed here; on a 401 it attempts a single silent
 * refresh and retry before redirecting to /login.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawFetch(path, init);

  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
    if (refreshed.ok) {
      res = await rawFetch(path, init);
    } else {
      window.location.assign('/login');
      throw new ApiError('Session expired', 401);
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.errors);
  }

  return data as T;
}
