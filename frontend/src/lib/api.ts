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

// Ticker symbols for every S&P 500 constituent that has a gold-layer file,
// straight from the S3 bucket listing (see app.services.s3_gold.list_tickers)
//  there's no company-name/exchange table backing this, just the symbols.
export function listTickers(): Promise<string[]> {
  return request<string[]>("/tickers");
}

export function listTickerQuotes(): Promise<Record<string, QuoteOut>> {
  return request<Record<string, QuoteOut>>("/tickers/quotes");
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

export type Interval = "daily" | "hourly";

// Mirrors app.schemas.history.OhlcHistoryPoint: gold-layer indicators joined
// with silver-layer OHLCV. Any field can be null  rolling indicators are
// unset for the first rows of a ticker's history, and open/high/low/volume
// are null if the silver-layer row for that date is ever missing.
export interface OhlcHistoryPoint {
  date: string;
  ticker: string;
  gics_sector: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;

  // Daily-only indicators (interval="daily")
  daily_return: number | null;
  rolling_30day_stddev: number | null;
  sma_50: number | null;
  sma_200: number | null;
  signal: string | null;
  macd_signal_line: number | null;

  // Hourly-only indicators (interval="hourly")
  hourly_return: number | null;
  sma_short: number | null;
  sma_long: number | null;

  // Shared indicators
  rsi: number | null;
  macd_line: number | null;
}

export function getHistoryOhlc(
  ticker: string,
  interval: Interval = "daily",
): Promise<OhlcHistoryPoint[]> {
  return request<OhlcHistoryPoint[]>(
    `/history/${encodeURIComponent(ticker)}/ohlc?interval=${interval}`,
  );
}

// --- AI Assistant (chatbot) ---------------------------------------------

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Streams the assistant's reply from the /chat endpoint. The backend responds
// with a plain-text stream of incremental token chunks; `onChunk` is called
// with each delta as it arrives. Pass an AbortSignal to cancel a reply.
export async function streamChat(
  messages: ChatMessage[],
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // no JSON body
    }
    throw new ApiError(response.status, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    if (delta) onChunk(delta);
  }
}
