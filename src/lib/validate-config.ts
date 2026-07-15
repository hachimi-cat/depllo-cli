/**
 * Dependency-free local sanity check for a .depllo-ci.yml.
 *
 * This is NOT the full parser — Depllo runs the authoritative
 * `parseCiConfig` server-side when you push. It catches the mistakes
 * that are cheap to detect from the raw text (tabs, the unsupported
 * `include:` key, no jobs, an obviously empty file) so you don't burn a
 * pipeline run on a typo.
 */

export const RESERVED_TOP_LEVEL = new Set(['stages', 'default', 'variables', 'workflow']);

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  jobs: string[];
}

export function validateCiConfig(text: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  if (text.trim().length === 0) {
    return { ok: false, errors: ['File is empty.'], warnings: [], jobs: [] };
  }

  const topLevelKeys: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    // Tabs are illegal for YAML indentation.
    if (/^\s*\t/.test(line) || /^\t/.test(line)) {
      errors.push(`Line ${lineNo}: tab indentation — YAML requires spaces.`);
    }
    // Strip comments for key detection.
    const noComment = line.replace(/\s+#.*$/, '');
    // A top-level key: starts at column 0, not a comment or list item.
    const m = /^([A-Za-z0-9_][A-Za-z0-9_.\-]*|\.[A-Za-z0-9_.\-]+)\s*:/.exec(noComment);
    if (m && !line.startsWith(' ') && !line.startsWith('#') && !line.startsWith('-')) {
      const key = m[1]!;
      if (seen.has(key)) errors.push(`Line ${lineNo}: duplicate top-level key "${key}".`);
      seen.add(key);
      topLevelKeys.push(key);
    }
  });

  if (topLevelKeys.includes('include')) {
    errors.push('`include:` is not supported by Depllo — keep the config in one file.');
  }

  // Jobs = top-level keys that aren't reserved and aren't hidden templates.
  const jobs = topLevelKeys.filter(
    (k) => !RESERVED_TOP_LEVEL.has(k) && !k.startsWith('.') && k !== 'include',
  );

  if (jobs.length === 0) {
    errors.push('No jobs found — define at least one top-level job with a `script:`.');
  }

  if (!topLevelKeys.includes('stages')) {
    warnings.push('No `stages:` key — Depllo defaults to [build, test, deploy].');
  }

  return { ok: errors.length === 0, errors, warnings, jobs };
}
