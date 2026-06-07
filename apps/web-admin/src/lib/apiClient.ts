/**
 * Typed API client for the Grovio admin panel (Phase 11).
 *
 * Uses cookie-based JWT auth (httpOnly admin_token cookie set by the server).
 * credentials: 'include' is set on all requests so the cookie is sent automatically.
 *
 * Unwraps the { success, data } | { success, error } API response envelope.
 * Throws an ApiError on { success: false } responses.
 */

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3001';

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
 * Core fetch wrapper. Sets JSON headers, includes credentials (httpOnly cookie),
 * and unwraps the API envelope.
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
    headers,
    credentials: 'include', // Send httpOnly admin_token cookie
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

/**
 * Upload a file using multipart/form-data (for KYC documents, product images).
 * Does NOT set Content-Type header — browser sets it automatically with the boundary.
 */
export async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    // NOTE: Do NOT set Content-Type header — browser must set it with the multipart boundary
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
