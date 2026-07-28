const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'erp.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Thrown for any non-2xx response so callers can show the server's own message. */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { field: string; message: string }[];

  constructor(status: number, message: string, code?: string, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    // A 401 anywhere means the session is gone — drop the token and bounce to login.
    if (response.status === 401 && getToken()) {
      clearToken();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    throw new ApiError(
      response.status,
      payload.message ?? `Request failed with status ${response.status}`,
      payload.code,
      payload.details,
    );
  }

  return payload.data as T;
}

/** Same as `api` but keeps the pagination envelope. */
export async function apiPaginated<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paginated<T>> {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    if (response.status === 401 && getToken()) {
      clearToken();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    throw new ApiError(response.status, payload.message ?? 'Request failed', payload.code, payload.details);
  }

  return {
    data: payload.data ?? [],
    meta: payload.meta ?? { page: 1, limit: 10, total: 0, totalPages: 1 },
  };
}

export { BASE_URL };
