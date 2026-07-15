import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../lib/api.js';
import { table, colorStatus, relTime } from '../lib/format.js';
import { fail } from '../lib/run.js';

interface RunnerView {
  id: string;
  name: string;
  tags: string[];
  status: string;
  maxConcurrent: number;
  shared: boolean;
  lastContactAt?: string | null;
}

export const runners = new Command('runners').description('Inspect CI runners');

runners
  .command('list')
  .alias('ls')
  .description('List runners available to your workspace')
  .option('--json', 'output raw JSON')
  .action(async (opts: { json?: boolean }) => {
    await fail(async () => {
      const { data } = await api<RunnerView[]>('/runners');
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      if (data.length === 0) {
        console.log(chalk.dim('No runners available.'));
        return;
      }
      console.log(
        table(
          ['ID', 'NAME', 'STATUS', 'TAGS', 'SLOTS', 'SCOPE', 'LAST SEEN'],
          data.map((r) => [
            r.id,
            r.name,
            colorStatus(r.status),
            r.tags.join(',') || '—',
            String(r.maxConcurrent),
            r.shared ? 'shared' : 'workspace',
            relTime(r.lastContactAt),
          ]),
        ),
      );
    });
  });
