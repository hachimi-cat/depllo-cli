import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { validateCiConfig } from '../lib/validate-config.js';

export const validate = new Command('validate')
  .argument('[path]', 'path to the config file', '.depllo-ci.yml')
  .description('Locally sanity-check a .depllo-ci.yml before you push')
  .action((file: string) => {
    const abs = path.resolve(process.cwd(), file);
    if (!fs.existsSync(abs)) {
      console.error(chalk.red(`✖ File not found: ${abs}`));
      process.exitCode = 1;
      return;
    }
    const text = fs.readFileSync(abs, 'utf8');
    const result = validateCiConfig(text);

    for (const w of result.warnings) console.log(chalk.yellow(`⚠ ${w}`));

    if (!result.ok) {
      for (const e of result.errors) console.error(chalk.red(`✖ ${e}`));
      process.exitCode = 1;
      return;
    }

    console.log(
      chalk.green(`✔ ${file} looks valid`) +
        chalk.dim(` — ${result.jobs.length} job(s): ${result.jobs.join(', ')}`),
    );
    console.log(chalk.dim('Note: this is a local check. The full parser runs on push.'));
  });
