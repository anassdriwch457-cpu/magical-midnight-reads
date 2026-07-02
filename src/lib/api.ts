import axios from "axios";

const RAW_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "http://localhost:8000/api";

function normalizeApiBaseUrl(value?: string): string {
  if (!value) return "";

  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const normalizedPath = url.pathname.replace(/\/$/, "");
    const looksLikeFrontendRoot = normalizedPath === "" || normalizedPath === "/";

    url.pathname = looksLikeFrontendRoot ? "/api" : normalizedPath;
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
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
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

interface RequestOptions {
  method?: string;
  body?: Json | FormData;
  anonymous?: boolean;
  headers?: Record<string, string>;
  silent?: boolean;
}

type ErrorListener = (err: ApiError | Error) => void;
const listeners = new Set<ErrorListener>();

export function onApiError(fn: ErrorListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emitError(err: ApiError | Error) {
  listeners.forEach((fn) => {
    try {
      fn(err);
    } catch {
      // ignore listener errors
    }
  });
}

export const axiosClient = axios.create({
  timeout: 15000,
  validateStatus: () => true,
});

axiosClient.interceptors.request.use((config) => {
  const headers = axios.AxiosHeaders.from(config.headers ?? {});
  headers.set("Accept", "application/json");
  if (config.data && !(config.data instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  config.headers = headers;
  return config;
});

axiosClient.interceptors.response.use((response) => {
  if (response.status === 401) {
    clearAuthToken();
  }
  return response;
});

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!HAS_LARAVEL_API) {
    throw new ApiError("API not configured (VITE_API_URL missing)", 0, null);
  }

  const { body, anonymous, headers, silent, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers ?? {}),
  };

  let finalBody: Json | FormData | undefined;
  if (body instanceof FormData) {
    finalBody = body;
  } else if (body !== undefined && body !== null) {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = body;
  }

  if (!anonymous) {
    const token = getAuthToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await axiosClient.request<string>({
      url,
      method: options.method ?? "GET",
      headers: finalHeaders,
      data: finalBody,
      responseType: "text",
      ...rest,
    });

    const status = res.status;
    const text = typeof res.data === "string" ? res.data : "";
    let responseData: unknown = null;
    if (text) {
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }

    if (status === 204) return undefined as T;

    if (status < 200 || status >= 300) {
      const rawMessage =
        responseData &&
        typeof responseData === "object" &&
        "message" in responseData &&
        typeof (responseData as { message: unknown }).message === "string"
          ? (responseData as { message: string }).message
          : res.statusText || `Request failed (${status})`;
      const message =
        typeof rawMessage === "string" &&
        rawMessage.includes("Only HTML requests are supported here")
          ? `API route misconfigured. Set VITE_API_URL to your Laravel API base, e.g. https://your-domain.com/api${path.startsWith("/") ? path : `/${path}`} was requested from ${url}.`
          : rawMessage;
      const err = new ApiError(message, status, responseData);
      if (!silent && status >= 500) emitError(err);
      throw err;
    }

    return responseData as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    const err = new ApiError(e instanceof Error ? e.message : "Network error", 0, null);
    if (!silent) emitError(err);
    throw err;
  }
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
