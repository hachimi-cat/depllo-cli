import { Command } from 'commander';
import chalk from 'chalk';
import { listProjects } from '../lib/projects.js';
import { table, colorStatus } from '../lib/format.js';
import { fail } from '../lib/run.js';

export const projects = new Command('projects').description('Manage CI projects');

projects
  .command('list')
  .alias('ls')
  .description('List projects in your workspace')
  .option('--json', 'output raw JSON')
  .action(async (opts: { json?: boolean }) => {
    await fail(async () => {
      const rows = await listProjects();
      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }
      if (rows.length === 0) {
        console.log(chalk.dim('No projects yet. Connect one in the dashboard: Projects → New.'));
        return;
      }
      console.log(
        table(
          ['ID', 'NAME', 'REPO', 'BRANCH', 'LATEST'],
          rows.map((p) => [
            p.id,
            p.name,
            p.repoFullName,
            p.defaultBranch,
            p.latestPipeline
              ? `#${p.latestPipeline.iid} ${colorStatus(p.latestPipeline.status)}`
              : '—',
          ]),
        ),
      );
    });
  });
