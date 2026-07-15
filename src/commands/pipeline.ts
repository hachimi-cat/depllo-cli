import { Command } from 'commander';
import chalk from 'chalk';
import { api } from '../lib/api.js';
import { resolveProject } from '../lib/projects.js';
import { table, colorStatus, relTime } from '../lib/format.js';
import { fail } from '../lib/run.js';

interface PipelineView {
  id: string;
  iid: number;
  sha: string;
  ref: string;
  source: string;
  status: string;
  createdAt: string;
}

interface LogResponse {
  jobId: string;
  status: string;
  complete: boolean;
  chunks: Array<{ seq: number; content: string }>;
  lastSeq: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const pipeline = new Command('pipeline')
  .alias('pipelines')
  .description('List, run, cancel, and tail pipelines');

pipeline
  .command('list <project>')
  .alias('ls')
  .description('List recent pipelines for a project')
  .option('--json', 'output raw JSON')
  .action(async (project: string, opts: { json?: boolean }) => {
    await fail(async () => {
      const p = await resolveProject(project);
      const { data } = await api<PipelineView[]>(`/projects/${p.id}/pipelines`);
      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }
      if (data.length === 0) {
        console.log(chalk.dim('No pipelines yet.'));
        return;
      }
      console.log(
        table(
          ['IID', 'STATUS', 'REF', 'SHA', 'SOURCE', 'CREATED'],
          data.map((pl) => [
            `#${pl.iid}`,
            colorStatus(pl.status),
            pl.ref,
            pl.sha.slice(0, 8),
            pl.source,
            relTime(pl.createdAt),
          ]),
        ),
      );
    });
  });

pipeline
  .command('run <project>')
  .description('Trigger a pipeline for a ref')
  .option('--ref <ref>', 'branch or tag to run (defaults to the project default branch)')
  .option('--var <key=value...>', 'pipeline variable (repeatable)', collectVars, {})
  .option('--json', 'output raw JSON')
  .action(
    async (
      project: string,
      opts: { ref?: string; var?: Record<string, string>; json?: boolean },
    ) => {
      await fail(async () => {
        const p = await resolveProject(project);
        const ref = opts.ref ?? p.defaultBranch;
        const { data } = await api<PipelineView>(`/projects/${p.id}/pipelines`, {
          method: 'POST',
          body: { ref, variables: opts.var ?? {} },
        });
        if (opts.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }
        console.log(
          chalk.green(`✔ Pipeline #${data.iid} created`) +
            chalk.dim(` (${data.status}) on ${data.ref}`),
        );
      });
    },
  );

pipeline
  .command('cancel <project> <iid>')
  .description('Cancel a pipeline by its #iid')
  .action(async (project: string, iid: string) => {
    await fail(async () => {
      const p = await resolveProject(project);
      const { data } = await api<{ iid?: number; status: string }>(
        `/projects/${p.id}/pipelines/${iid}/cancel`,
        { method: 'POST' },
      );
      console.log(chalk.yellow(`✔ Pipeline #${iid} → ${data.status}`));
    });
  });

pipeline
  .command('logs <jobId>')
  .description('Print (and optionally tail) a job\'s logs')
  .option('-f, --follow', 'stream new log output until the job finishes')
  .action(async (jobId: string, opts: { follow?: boolean }) => {
    await fail(async () => {
      let from = 0;
      for (;;) {
        const { data } = await api<LogResponse>(`/jobs/${jobId}/log`, { query: { from } });
        for (const chunk of data.chunks) {
          process.stdout.write(chunk.content);
          from = chunk.seq + 1;
        }
        if (data.complete || !opts.follow) {
          if (data.complete) {
            process.stdout.write('\n');
            console.error(chalk.dim(`— job ${colorStatus(data.status)} —`));
          } else {
            console.error(chalk.dim('— job still running; pass --follow to tail —'));
          }
          return;
        }
        await sleep(1500);
      }
    });
  });

function collectVars(pair: string, acc: Record<string, string>): Record<string, string> {
  const eq = pair.indexOf('=');
  if (eq === -1) throw new Error(`--var expects key=value, got "${pair}"`);
  acc[pair.slice(0, eq)] = pair.slice(eq + 1);
  return acc;
}
