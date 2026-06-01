/**
 * Cookie-credentialed API client for the Grovio storefront.
 *
 * Every method passes `credentials: 'include'` so the browser automatically
 * attaches httpOnly auth cookies to all requests (D-09).
 *
 * Base URL is read from the Vite env var VITE_API_URL (bracket access per
 * Pattern K — App.tsx line 4 convention).
 */

const BASE_URL = import.meta.env['VITE_API_URL'] as string;

/**
 * Error class thrown by apiClient on non-2xx responses.
 * Carries the HTTP status code and the parsed error body so callers and
 * React Query retry logic can inspect them without re-parsing.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // exactOptionalPropertyTypes: use null (not undefined) for optional BodyInit
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    return handleResponse<T>(res);
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<T>(res);
  },
};
