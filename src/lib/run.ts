import chalk from 'chalk';
import { ApiCliError } from './api.js';

/**
 * Run a command action, turning thrown errors into a clean one-line
 * message + non-zero exit code (instead of a stack trace).
 */
export async function fail(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const err = e as Error;
    const prefix = err instanceof ApiCliError && err.code ? `${err.code}: ` : '';
    console.error(chalk.red(`✖ ${prefix}${err.message}`));
    process.exitCode = 1;
  }
}
