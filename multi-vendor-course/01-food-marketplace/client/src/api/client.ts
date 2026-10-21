const ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = `${ORIGIN}/api`;

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  errors?: { path: string; message: string }[];

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
    errors?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.errors = errors;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    if (!response.ok) throw new Error("Refresh failed");
    const data = (await response.json()) as { accessToken: string };
    accessToken = data.accessToken;
    return data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  retry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, retry = true, headers, ...rest } = options;
  const isFormData = body instanceof FormData;
  const response = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
  });

  if (response.status === 401 && retry && !path.startsWith("/auth/")) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, retry: false });
    } catch {
      accessToken = null;
      unauthorizedHandler?.();
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      accessToken = null;
      unauthorizedHandler?.();
    }
    const data = typeof payload === "object" && payload ? payload : {};
    throw new ApiError(
      response.status,
      (data as { message?: string }).message ?? "Request failed",
      (data as { code?: string }).code,
      (data as { details?: unknown }).details,
      (data as { errors?: { path: string; message: string }[] }).errors
    );
  }

  return payload as T;
}

export const api = {
  get<T>(path: string) {
    return apiFetch<T>(path);
  },
  post<T>(path: string, body?: unknown) {
    return apiFetch<T>(path, { method: "POST", body });
  },
  patch<T>(path: string, body?: unknown) {
    return apiFetch<T>(path, { method: "PATCH", body });
  },
  delete<T>(path: string) {
    return apiFetch<T>(path, { method: "DELETE" });
  },
  upload<T>(path: string, formData: FormData) {
    return apiFetch<T>(path, { method: "POST", body: formData });
  }
};

export function apiOrigin(): string {
  return ORIGIN;
}
