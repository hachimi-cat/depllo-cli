import { CredentialsError, resolveBearer } from './credentials.js';

/**
 * Thin API client for the Depllo CLI. Wraps the family
 * `{ data, error, meta }` envelope and resolves the base URL + bearer
 * token from the environment or the stored session.
 *
 * Token resolution order (lib/credentials.ts):
 *   1. `DEPLLO_TOKEN` env (handy in CI / scripts)
 *   2. the API key saved by `depllo auth login --api-key <key>`
 *   3. the Huudis session saved by `depllo auth login` (~/.depllo/session.json),
 *      refreshed when it is about to expire.
 */

function brand(): string {
  return process.env.DEPLLO ?? 'depllo';
}

export function baseUrl(): string {
  const raw = process.env.DEPLLO_API_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/+$/, '');
  return 'https://depllo.forjio.com/api/v1';
}

export async function resolveToken(): Promise<string | null> {
  try {
    return (await resolveBearer())?.token ?? null;
  } catch (e) {
    if (e instanceof CredentialsError) throw new ApiCliError(e.message, e.code, 401);
    throw e;
  }
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
  /** Set instead of `data` when the route answers with bytes (a job artifact, a badge
   *  SVG): not JSON, and not an HTML or plain-text page. */
  file?: { bytes: Uint8Array; contentType: string };
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
    const token = await resolveToken();
    if (!token) {
      throw new ApiCliError(
        `Not signed in. Run \`${brand()} auth login\` (or \`${brand()} auth login --api-key <key>\`), or set DEPLLO_TOKEN.`,
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

  const type = res.headers.get('content-type') ?? '';
  if (res.ok && type && !/json|text\/(html|plain)/i.test(type)) {
    // A file. An HTML or plain-text page at an API path is a wrong base URL or a proxy,
    // and stays an error below.
    return { data: undefined as T, error: null, file: { bytes: new Uint8Array(await res.arrayBuffer()), contentType: type } };
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
