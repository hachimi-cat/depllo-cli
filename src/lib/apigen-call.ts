/**
 * How the generated `depllo api <area> <action>` commands (commands/api.generated.ts)
 * make their call: this CLI's own client and credentials (lib/api.ts — DEPLLO_TOKEN, an
 * sk_live_… API key, or the stored session; DEPLLO_API_URL), its own error line and exit
 * code (lib/run.ts). A route that answers with bytes writes them to stdout as they are.
 */
import type { Command } from 'commander';
import { api } from './api.js';
import { fail } from './run.js';

/** The spec's paths carry the /api/v1 prefix; the client's base URL already ends in it. */
const PREFIX = '/api/v1';

export async function callRoute(
  _cmd: Command,
  method: string,
  path: string,
  query: Record<string, unknown>,
  body: Record<string, unknown> | undefined,
): Promise<void> {
  await fail(async () => {
    const q = Object.fromEntries(
      Object.entries(query).map(([k, v]): [string, string] => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
    );
    const { data, file } = await api<unknown>(path.startsWith(PREFIX) ? path.slice(PREFIX.length) || '/' : path, {
      method,
      query: Object.keys(q).length ? q : undefined,
      body,
    });
    // bytes (an artifact, a badge SVG) as they are: `depllo api jobs artifacts-download … > dist.zip`
    if (file) process.stdout.write(Buffer.from(file.bytes));
    else console.log(JSON.stringify(data, null, 2));
  });
}

/** Bad input to a generated command (a missing field, a value the spec does not allow). */
export async function failRoute(_cmd: Command, err: unknown): Promise<void> {
  await fail(async () => {
    throw err instanceof Error ? err : new Error(String(err));
  });
}
