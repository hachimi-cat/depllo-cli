import { api } from './api.js';

export interface ProjectView {
  id: string;
  name: string;
  repoFullName: string;
  defaultBranch: string;
  configPath: string;
  webhookStatus?: string;
  latestPipeline?: { iid: number; status: string } | null;
}

/** List all projects in the active workspace. */
export async function listProjects(): Promise<ProjectView[]> {
  const { data } = await api<ProjectView[]>('/projects');
  return data;
}

/**
 * Resolve a project by id (`proj_…`), exact repoFullName (`owner/repo`),
 * or (case-insensitive) name. Throws a clear error on no/ambiguous match.
 */
export async function resolveProject(ref: string): Promise<ProjectView> {
  const projects = await listProjects();
  const byId = projects.find((p) => p.id === ref);
  if (byId) return byId;
  const byRepo = projects.find((p) => p.repoFullName === ref);
  if (byRepo) return byRepo;
  const lower = ref.toLowerCase();
  const byName = projects.filter((p) => p.name.toLowerCase() === lower);
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    throw new Error(`"${ref}" matches multiple projects — use the proj_ id or owner/repo.`);
  }
  throw new Error(`No project matches "${ref}". Run \`depllo projects list\`.`);
}
