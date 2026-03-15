import { ResponseCache } from "./cache.js";
import type { TokenResponse } from "./types.js";

const BASE_URL = "https://api.wflow.com";
const TOKEN_URL = "https://account.wflow.com/connect/token";
const TIMEOUT_MS = 30_000;
const FORBIDDEN_PATH = /[#]|\.\./;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

const RECOVERY_HINTS: Record<number, string> = {
  400: "Invalid request parameters. Check field names and value formats.",
  401: "Token expired or invalid. The server will refresh automatically on next request.",
  403: "Insufficient permissions. Verify your API client has the uccl_common_api scope.",
  404: "Resource not found. Verify organization name, document ID, or other identifiers.",
  409: "Conflict — the resource may be locked or already exists.",
  422: "Validation failed. Check required fields and data constraints.",
  429: "Rate limit exceeded. Request will be retried automatically.",
  500: "wflow internal error. Try again in a few seconds.",
};

export interface WflowConfig {
  clientId: string;
  clientSecret: string;
  organization?: string;
  cacheTtl?: number;
  maxRetries?: number;
}

function validatePath(path: string): void {
  if (FORBIDDEN_PATH.test(path)) {
    throw new Error(`Unsafe API path rejected: "${path}"`);
  }
  if (!path.startsWith("/")) {
    throw new Error(`API path must start with "/": "${path}"`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class WflowClient {
  private clientId: string;
  private clientSecret: string;
  readonly defaultOrg: string | undefined;
  readonly cache: ResponseCache;

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private maxRetries: number;

  constructor(config: WflowConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.defaultOrg = config.organization;
    this.maxRetries = config.maxRetries ?? 3;
    this.cache = new ResponseCache(config.cacheTtl ?? 120);
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "uccl_common_api",
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OAuth2 token request failed (${res.status}): ${text.slice(0, 500)}\n` +
        "Check WFLOW_CLIENT_ID and WFLOW_CLIENT_SECRET values.",
      );
    }

    const token = (await res.json()) as TokenResponse;
    this.accessToken = token.access_token;
    this.tokenExpiresAt = Date.now() + token.expires_in * 1000;
    return this.accessToken;
  }

  resolveOrg(org?: string): string {
    const resolved = org || this.defaultOrg;
    if (!resolved) {
      throw new Error(
        "Organization not specified. Set WFLOW_ORGANIZATION env var or pass 'organization' parameter.",
      );
    }
    return resolved;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
  ): Promise<T> {
    validatePath(path);

    const upperMethod = method.toUpperCase();
    let url = `${BASE_URL}${path}`;
    if (query && Object.keys(query).length > 0) {
      url += "?" + new URLSearchParams(query).toString();
    }

    const cacheKey = `${upperMethod}:${url}`;
    if (upperMethod === "GET" && this.cache.enabled) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) return cached;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const token = await this.authenticate();

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        };

        const bodyStr = body != null ? JSON.stringify(body) : undefined;
        if (bodyStr) headers["Content-Type"] = "application/json";

        const res = await fetch(url, {
          method: upperMethod,
          headers,
          body: bodyStr,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (res.status === 401 && attempt < this.maxRetries) {
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          continue;
        }

        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(1000 * 2 ** attempt, 30_000);

          if (attempt < this.maxRetries) {
            await sleep(waitMs);
            continue;
          }
        }

        const text = await res.text();

        if (!res.ok) {
          let detail = text.slice(0, 500);
          try {
            const err = JSON.parse(text) as { detail?: string; title?: string; message?: string };
            detail = (err.detail || err.title || err.message || text).slice(0, 500);
          } catch { /* raw text */ }

          const hint = RECOVERY_HINTS[res.status] || "";
          const hintSuffix = hint ? `\nRecovery: ${hint}` : "";
          throw new Error(
            `wflow ${upperMethod} ${path} → ${res.status}: ${detail}${hintSuffix}`,
          );
        }

        if (res.status === 204 || !text) {
          if (upperMethod !== "GET") this.invalidateRelated(path);
          return undefined as unknown as T;
        }

        let parsed: T;
        try {
          parsed = JSON.parse(text) as T;
        } catch {
          throw new Error(
            `wflow ${upperMethod} ${path}: expected JSON but got: ${text.slice(0, 200)}`,
          );
        }

        if (upperMethod === "GET" && this.cache.enabled) {
          this.cache.set(cacheKey, parsed);
        } else if (upperMethod !== "GET") {
          this.invalidateRelated(path);
        }

        return parsed;
      } catch (err) {
        lastError = err as Error;
        if ((err as Error).name === "TimeoutError" && attempt < this.maxRetries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        if (attempt >= this.maxRetries) break;
        const msg = (err as Error).message || "";
        if (msg.includes("429") || msg.includes("401")) continue;
        break;
      }
    }

    throw lastError ?? new Error(`wflow ${method.toUpperCase()} ${path} failed after retries`);
  }

  private invalidateRelated(path: string): void {
    if (path.includes("/documents")) {
      this.cache.invalidate("/documents");
    }
    if (path.includes("/storage")) {
      this.cache.invalidate("/storage");
    }
    if (path.includes("/registers")) {
      this.cache.invalidate("/registers");
    }
    if (path.includes("/users") || path.includes("/roles") || path.includes("/teams")) {
      this.cache.invalidate("/users");
      this.cache.invalidate("/roles");
      this.cache.invalidate("/teams");
    }
  }

  get<T = unknown>(path: string, query?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, query);
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  put<T = unknown>(path: string, body?: unknown, query?: Record<string, string>) {
    return this.request<T>("PUT", path, body, query);
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  del<T = unknown>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
