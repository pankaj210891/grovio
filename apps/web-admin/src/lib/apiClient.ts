/**
 * Typed API client for the Grovio admin panel.
 *
 * Targets the API base URL, sets JSON headers, includes the X-Internal-Admin-Token
 * header for admin mutations (read from an env var via import.meta.env), and unwraps
 * the { success, data } | { success, error } response envelope.
 *
 * Throws an ApiError on { success: false } responses.
 * Phase 4 replaces the X-Internal-Admin-Token header with JWT middleware.
 */

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

// SECURITY NOTE (T-02-18 / Phase 2 dev-only placeholder):
// VITE_* variables are inlined into the browser bundle at build time and are
// publicly visible in DevTools and the compiled JS. This token is a Phase 2
// development convenience ONLY and must NOT be deployed to any externally
// accessible URL until Phase 4 replaces it with JWT (jose, admin role claim).
// Any user who can access the admin panel URL can extract this token.
// Do NOT treat it as a secret in non-localhost environments.
const ADMIN_TOKEN = import.meta.env['VITE_INTERNAL_ADMIN_TOKEN'] ?? '';
if (!ADMIN_TOKEN) {
  console.warn(
    '[apiClient] VITE_INTERNAL_ADMIN_TOKEN is not set — admin mutations will be rejected by the server in production',
  );
}

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
 * Core fetch wrapper. Sets common headers and unwraps the API envelope.
 * Throws ApiError for non-2xx or { success: false } responses.
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

  // Include admin token for all requests — Phase 4 replaces with JWT
  if (ADMIN_TOKEN) {
    headers['X-Internal-Admin-Token'] = ADMIN_TOKEN;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
