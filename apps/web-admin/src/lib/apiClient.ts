/**
 * Typed API client for the Grovio admin panel.
 *
 * Uses cookie-based authentication (credentials: 'include').
 * The Phase 2 X-Internal-Admin-Token header bypass has been removed — Phase 6
 * requires httpOnly cookie JWT auth on all admin endpoints (T-06-32).
 *
 * On 401 responses, redirects to /auth/login so protected routes stay guarded.
 */

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

/**
 * Core fetch wrapper. Sets common headers, sends credentials (cookies), and
 * unwraps the API envelope.
 * Throws ApiError for non-2xx or { success: false } responses.
 * Redirects to /auth/login on 401 (expired or missing admin session).
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  // On 401, redirect to login — the admin session has expired or never started
  if (response.status === 401) {
    window.location.href = '/auth/login';
    throw new ApiError('UNAUTHORIZED', 'Session expired — redirecting to login.', 401);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('PARSE_ERROR', `Failed to parse response from ${path}`, response.status);
  }

  if (!envelope.success) {
    const err = (envelope as ApiErrorEnvelope).error;
    throw new ApiError(err.code, err.message, response.status);
  }

  return (envelope as ApiSuccessEnvelope<T>).data;
}

// --- HTTP method helpers ---

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) init.body = JSON.stringify(body);
  return request<T>(path, init);
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'PATCH' };
  if (body !== undefined) init.body = JSON.stringify(body);
  return request<T>(path, init);
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: 'PUT' };
  if (body !== undefined) init.body = JSON.stringify(body);
  return request<T>(path, init);
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
