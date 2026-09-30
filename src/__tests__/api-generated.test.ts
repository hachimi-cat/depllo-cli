import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

// `depllo api <area> <action>`: every feature route, generated from the API spec.
// The CLI's own client (lib/api.ts `api`) is stubbed; one test runs it for real over a
// stubbed fetch to check the token and base URL it uses.
const apiStub = vi.fn();
vi.mock('../lib/api.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/api.js')>();
  return { ...real, api: (...args: Parameters<typeof real.api>) => apiStub(...args) };
});

const { API_ROUTES, buildApiCommand } = await import('../commands/api.generated.js');
const realApi = (await vi.importActual<typeof import('../lib/api.js')>('../lib/api.js')).api;

const ORIGINAL_ENV = { ...process.env };
let out: string[];
let err: string[];

async function run(args: string[]): Promise<number> {
  process.exitCode = undefined;
  const program = new Command('depllo').exitOverride();
  program.addCommand(buildApiCommand());
  await program.parseAsync(['node', 'depllo', ...args]);
  const code = Number(process.exitCode ?? 0);
  process.exitCode = undefined;
  return code;
}

beforeEach(() => {
  out = [];
  err = [];
  apiStub.mockReset();
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { out.push(a.join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { err.push(a.join(' ')); });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('depllo api', () => {
  it('has a command for every feature route', () => {
    const count = API_ROUTES.reduce((n, a) => n + a.routes.length, 0);
    expect(count).toBeGreaterThan(40);
    const areas = API_ROUTES.map((a) => a.area);
    expect(areas).toEqual(expect.arrayContaining(['projects', 'pipelines', 'jobs', 'runners', 'schedules', 'api-keys']));
  });

  it('creates a project variable from flags, typed as the spec says', async () => {
    apiStub.mockResolvedValue({ data: { id: 'var_1' }, error: null });
    const code = await run([
      'api', 'projects', 'create-variables', 'proj_1',
      '--key', 'API_URL', '--value', 'https://x', '--backend', 'local', '--masked',
    ]);
    expect(code).toBe(0);
    expect(apiStub).toHaveBeenCalledWith('/projects/proj_1/variables', {
      method: 'POST',
      query: undefined,
      body: { key: 'API_URL', value: 'https://x', backend: 'local', masked: true },
    });
    expect(JSON.parse(out.join('\n'))).toEqual({ id: 'var_1' });
  });

  it('refuses a value the spec does not allow, and a missing required field', async () => {
    expect(await run(['api', 'projects', 'create-variables', 'proj_1', '--key', 'K', '--value', 'v', '--backend', 'vault'])).toBe(1);
    expect(err.join('\n')).toMatch(/--backend must be one of: local, secronna/);
    expect(await run(['api', 'projects', 'create-variables', 'proj_1', '--key', 'K'])).toBe(1);
    expect(err.join('\n')).toMatch(/missing --value/);
    expect(apiStub).not.toHaveBeenCalled();
  });

  it('puts path parameters in the path and query fields in the query', async () => {
    apiStub.mockResolvedValue({ data: [], error: null });
    expect(await run(['api', 'jobs', 'log', 'job 1', '--from', '5'])).toBe(0);
    expect(apiStub).toHaveBeenLastCalledWith('/jobs/job%201/log', { method: 'GET', query: { from: '5' }, body: undefined });
    expect(await run(['api', 'schedules', 'list'])).toBe(0);
    expect(apiStub).toHaveBeenLastCalledWith('/schedules', { method: 'GET', query: undefined, body: undefined });
  });

  it('calls the API with the CLI token and base URL', async () => {
    apiStub.mockImplementation(realApi);
    process.env.DEPLLO_TOKEN = 'tok_cli';
    process.env.DEPLLO_API_URL = 'http://localhost:4200/api/v1';
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      seen.push({ url: String(input), init });
      return new Response(JSON.stringify({ data: { id: 'pipe_1' }, error: null }), { status: 201 });
    });
    expect(await run(['api', 'projects', 'create-pipelines', 'proj_1', '--ref', 'main'])).toBe(0);
    expect(seen[0]!.url).toBe('http://localhost:4200/api/v1/projects/proj_1/pipelines');
    const headers = seen[0]!.init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok_cli');
    expect(headers['Idempotency-Key']).toMatch(/^cli_/);
    expect(JSON.parse(String(seen[0]!.init!.body))).toEqual({ ref: 'main' });
  });

  it('manages API keys (a signed-in person; the server refuses a key)', async () => {
    apiStub.mockResolvedValue({ data: { id: 'ak_1', key: 'sk_live_x' }, error: null });
    expect(await run(['api', 'api-keys', 'create', '--name', 'catent'])).toBe(0);
    expect(apiStub).toHaveBeenLastCalledWith('/api-keys', { method: 'POST', query: undefined, body: { name: 'catent' } });
    expect(await run(['api', 'api-keys', 'delete', 'ak_1'])).toBe(0);
    expect(apiStub).toHaveBeenLastCalledWith('/api-keys/ak_1', { method: 'DELETE', query: undefined, body: undefined });
  });

  it('reports a server error the CLI way', async () => {
    const { ApiCliError } = await import('../lib/api.js');
    apiStub.mockRejectedValue(new ApiCliError('project not found', 'NOT_FOUND', 404));
    expect(await run(['api', 'projects', 'get', 'proj_x'])).toBe(1);
    expect(err.join('\n')).toMatch(/NOT_FOUND: project not found/);
  });

  it('writes a file route (a job artifact) to stdout as bytes', async () => {
    apiStub.mockImplementation(realApi);
    process.env.DEPLLO_TOKEN = 'tok_cli';
    process.env.DEPLLO_API_URL = 'http://localhost:4200/api/v1';
    const written: Buffer[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: Uint8Array) => { written.push(Buffer.from(chunk)); return true; }) as typeof process.stdout.write);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(new Uint8Array([80, 75, 3, 4]), { headers: { 'Content-Type': 'application/zip' } }),
    );
    expect(await run(['api', 'jobs', 'artifacts-download', 'job_1', 'art_1'])).toBe(0);
    expect(Buffer.concat(written)).toEqual(Buffer.from([80, 75, 3, 4]));
    expect(out).toEqual([]);
  });
});
