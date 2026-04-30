/**
 * Laravel API client (Sanctum bearer-token auth).
 *
 * Configure base URL via VITE_API_URL (e.g. https://api.example.com/api).
 * When VITE_API_URL is unset, the app runs in MOCK mode (see supabase client).
 */

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function normalizeApiBaseUrl(value?: string): string {
  if (!value) return "";

  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/$/, "");
    const looksLikeFrontendRoot = normalizedPath === "" || normalizedPath === "/";

    if (looksLikeFrontendRoot) {
      url.pathname = "/api";
    } else {
      url.pathname = normalizedPath;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export const API_BASE_URL = normalizeApiBaseUrl(RAW_BASE);
export const HAS_LARAVEL_API = !!API_BASE_URL;

const TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type Json = Record<string, unknown> | unknown[] | null;

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: Json | FormData;
  anonymous?: boolean;
  /** Suppress console error logging (used by graceful fallbacks). */
  silent?: boolean;
}

/** Global error listeners — used by UI to surface "API down" toasts once. */
type ErrorListener = (err: ApiError | Error) => void;
const listeners = new Set<ErrorListener>();
export function onApiError(fn: ErrorListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emitError(err: ApiError | Error) {
  listeners.forEach((fn) => { try { fn(err); } catch { /* ignore */ } });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!HAS_LARAVEL_API) {
    throw new ApiError("API not configured (VITE_API_URL missing)", 0, null);
  }

  const { body, anonymous, headers, silent, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };

  let finalBody: BodyInit | undefined;
  if (body instanceof FormData) {
    finalBody = body;
  } else if (body !== undefined && body !== null) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  }

  if (!anonymous) {
    const token = getAuthToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody });
  } catch (e) {
    const err = new ApiError(
      e instanceof Error ? e.message : "Network error",
      0,
      null,
    );
    if (!silent) emitError(err);
    throw err;
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const rawMessage =
      (data && typeof data === "object" && "message" in data &&
        typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : null) ?? res.statusText ?? `Request failed (${res.status})`;
    const message =
      typeof rawMessage === "string" && rawMessage.includes("Only HTML requests are supported here")
        ? `API route misconfigured. Set VITE_API_URL to your Laravel API base, e.g. https://your-domain.com/api${path.startsWith("/") ? path : `/${path}`} was requested from ${url}.`
        : rawMessage;
    if (res.status === 401) clearAuthToken();
    const err = new ApiError(message, res.status, data);
    if (!silent && res.status >= 500) emitError(err);
    throw err;
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: Json | FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: Json | FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: Json | FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
