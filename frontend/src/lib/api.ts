const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Endpoints that should never trigger a refresh-and-retry on 401: retrying
// /auth/refresh itself would recurse, and a 401 from login/register means
// bad credentials, not an expired session.
const NO_REFRESH_PATHS = ["/auth/refresh", "/auth/login", "/auth/register"];

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401 && allowRefresh && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface AuthResponse {
  authenticated: boolean;
}

export interface RegisterResponse {
  authenticated: boolean;
  message: string;
}

export interface ProfileOut {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function registerUser(payload: {
  email: string;
  password: string;
  full_name?: string;
}): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function getCurrentProfile(): Promise<ProfileOut> {
  return request<ProfileOut>("/users/me");
}

export interface TickerOut {
  ticker: string;
  name: string;
  gics_sector: string | null;
  exchange: string | null;
}

export function listTickers(params?: {
  search?: string;
  sector?: string;
  limit?: number;
}): Promise<TickerOut[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.sector) query.set("sector", params.sector);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return request<TickerOut[]>(`/tickers${qs ? `?${qs}` : ""}`);
}

export interface QuoteOut {
  ticker: string;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  currency: string | null;
}

export function getQuote(ticker: string): Promise<QuoteOut> {
  return request<QuoteOut>(`/quote/${ticker}`);
}
