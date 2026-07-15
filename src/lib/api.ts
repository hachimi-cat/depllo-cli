import { loadSession } from './session.js';

/**
 * Thin API client for the Depllo CLI. Wraps the family
 * `{ data, error, meta }` envelope and resolves the base URL + bearer
 * token from the environment or the stored session.
 *
 * Token resolution order:
 *   1. `DEPLLO_TOKEN` env (handy in CI / scripts)
 *   2. the access token from `~/.depllo/session.json` (`auth login`)
 */

function brand(): string {
  return process.env.DEPLLO ?? 'depllo';
}

export function baseUrl(): string {
  const raw = process.env.DEPLLO_API_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/+$/, '');
  return 'https://depllo.forjio.com/api/v1';
}

export function resolveToken(): string | null {
  const envToken = process.env.DEPLLO_TOKEN?.trim();
  if (envToken) return envToken;
  const session = loadSession();
  return session?.accessToken ?? null;
}

export class ApiCliError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiCliError';
  }
}

export interface Envelope<T> {
  data: T;
  error: { code: string; message: string } | null;
  meta?: { requestId?: string; cursor?: string | null; hasMore?: boolean };
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Require auth (default true). */
  auth?: boolean;
}

export async function api<T>(path: string, opts: RequestOpts = {}): Promise<Envelope<T>> {
  const { method = 'GET', body, query, auth = true } = opts;
  const url = new URL(baseUrl() + (path.startsWith('/') ? path : `/${path}`));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') {
    // Idempotency for mutating calls (family convention).
    headers['Idempotency-Key'] = `cli_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  if (auth) {
    const token = resolveToken();
    if (!token) {
      throw new ApiCliError(
        `Not signed in. Run \`${brand()} auth login\`, or set DEPLLO_TOKEN.`,
        'AUTH_REQUIRED',
      );
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiCliError(`Request failed: ${(e as Error).message}. Is ${baseUrl()} reachable?`);
  }

  const text = await res.text();
  let parsed: Envelope<T> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    // Non-JSON (e.g. an nginx error page) — surface the status.
  }

  if (!res.ok) {
    const err = parsed?.error;
    throw new ApiCliError(
      err?.message ?? `HTTP ${res.status} ${res.statusText}`,
      err?.code,
      res.status,
    );
  }
  if (!parsed) {
    throw new ApiCliError('Empty or non-JSON response from server.');
  }
  return parsed;
}
