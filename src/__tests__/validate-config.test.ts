import { describe, it, expect } from 'vitest';
import { validateCiConfig } from '../lib/validate-config.js';

describe('validateCiConfig', () => {
  it('accepts a well-formed config and lists jobs', () => {
    const yaml = [
      'stages: [test, build]',
      'variables:',
      '  NODE_ENV: test',
      'test:',
      '  script:',
      '    - npm test',
      'build:',
      '  needs: [test]',
      '  script:',
      '    - npm run build',
    ].join('\n');
    const r = validateCiConfig(yaml);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.jobs).toEqual(['test', 'build']);
  });

  it('flags an empty file', () => {
    const r = validateCiConfig('   \n  ');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/empty/i);
  });

  it('rejects unsupported include:', () => {
    const r = validateCiConfig('include:\n  - remote.yml\ntest:\n  script: [echo hi]');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes('include'))).toBe(true);
  });

  it('rejects tab indentation', () => {
    const r = validateCiConfig('test:\n\tscript: [echo hi]');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /tab/i.test(e))).toBe(true);
  });

  it('errors when there are no jobs (only reserved keys)', () => {
    const r = validateCiConfig('stages: [test]\nvariables:\n  A: b');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /no jobs/i.test(e))).toBe(true);
  });

  it('does not count hidden templates as jobs', () => {
    const yaml = ['.base:', '  script: [echo hi]', 'test:', '  extends: .base'].join('\n');
    const r = validateCiConfig(yaml);
    expect(r.jobs).toEqual(['test']);
  });

  it('flags duplicate top-level keys', () => {
    const r = validateCiConfig('test:\n  script: [a]\ntest:\n  script: [b]');
    expect(r.errors.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it('warns when stages is missing', () => {
    const r = validateCiConfig('test:\n  script: [echo hi]');
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => /stages/i.test(w))).toBe(true);
  });
});
