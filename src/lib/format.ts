import chalk from 'chalk';

/** Render an array of rows as a simple aligned text table. */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => (c ?? '').padEnd(widths[i] ?? 0)).join('  ');
  const out = [chalk.bold(line(headers))];
  for (const r of rows) out.push(line(r));
  return out.join('\n');
}

const STATUS_COLORS: Record<string, (s: string) => string> = {
  success: chalk.green,
  failed: chalk.red,
  running: chalk.cyan,
  pending: chalk.yellow,
  created: chalk.gray,
  canceled: chalk.gray,
  skipped: chalk.dim,
  manual: chalk.magenta,
  online: chalk.green,
  offline: chalk.gray,
  paused: chalk.yellow,
};

export function colorStatus(status: string): string {
  return (STATUS_COLORS[status] ?? chalk.white)(status);
}

export function relTime(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
