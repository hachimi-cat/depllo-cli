import { Command } from 'commander';
import { auth } from './commands/auth.js';
import { projects } from './commands/projects.js';
import { pipeline } from './commands/pipeline.js';
import { runners } from './commands/runners.js';
import { validate } from './commands/validate.js';
import { buildApiCommand } from './commands/api.generated.js';

const brand = process.env.DEPLLO ?? 'depllo';

const program = new Command()
  .name(brand)
  .description(`CLI for ${brand} — GitLab-CI-style CI/CD for your GitHub repos.`)
  .version('0.3.0');

program.addCommand(auth);
program.addCommand(projects);
program.addCommand(pipeline);
program.addCommand(runners);
program.addCommand(validate);
program.addCommand(buildApiCommand());

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
