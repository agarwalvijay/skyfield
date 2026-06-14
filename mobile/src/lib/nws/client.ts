/**
 * Low-level fetch wrapper for the US National Weather Service API (api.weather.gov).
 *
 * No API key is required. The NWS asks that every request send a descriptive
 * User-Agent; browsers forbid setting User-Agent, so we send an `App` header and
 * a contact query the NWS also accepts. This module is dependency-free and
 * platform-agnostic so it can be reused verbatim in a React Native port.
 */

const BASE = "https://api.weather.gov";

export class NwsError extends Error {
  status: number;
  detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "NwsError";
    this.status = status;
    this.detail = detail;
  }
}

export interface NwsRequestOptions {
  /** Override the Accept header (e.g. text/plain for raw products). */
  accept?: string;
  signal?: AbortSignal;
  /** Number of automatic retries on 5xx / network errors. */
  retries?: number;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a path (absolute api.weather.gov URL or path) and parse it.
 * Retries transient failures with backoff. NWS occasionally 500s and
 * recovers on immediate retry, so this materially improves reliability.
 */
export async function nwsFetch<T = unknown>(
  pathOrUrl: string,
  opts: NwsRequestOptions = {},
): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const accept = opts.accept ?? "application/geo+json";
  const maxRetries = opts.retries ?? 2;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Only send CORS-safelisted headers. Custom headers (User-Agent, App,
      // Feature-Flags) trigger a preflight that api.weather.gov rejects, which
      // would break every request from the browser.
      const res = await fetch(url, {
        signal: opts.signal,
        headers: { Accept: accept },
      });

      if (res.status === 404) {
        throw new NwsError("Not found", 404);
      }
      if (res.status >= 500) {
        throw new NwsError(`NWS server error (${res.status})`, res.status);
      }
      if (!res.ok) {
        let detail: string | undefined;
        try {
          const body = await res.json();
          detail = body?.detail || body?.title;
        } catch {
          /* ignore */
        }
        throw new NwsError(detail || `Request failed (${res.status})`, res.status, detail);
      }

      if (accept.startsWith("text/")) {
        return (await res.text()) as unknown as T;
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      // Don't retry definitive client errors.
      if (err instanceof NwsError && err.status === 404) throw err;
      if (err instanceof NwsError && err.status >= 400 && err.status < 500) throw err;
      if (attempt < maxRetries) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new NwsError("Network error", 0);
}
