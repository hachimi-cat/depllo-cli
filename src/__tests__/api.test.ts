import { describe, it, expect, afterEach } from 'vitest';
import { baseUrl, resolveToken } from '../lib/api.js';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('baseUrl', () => {
  it('defaults to the prod API', () => {
    delete process.env.DEPLLO_API_URL;
    expect(baseUrl()).toBe('https://depllo.forjio.com/api/v1');
  });

  it('honors DEPLLO_API_URL and strips trailing slashes', () => {
    process.env.DEPLLO_API_URL = 'http://localhost:4200/api/v1/';
    expect(baseUrl()).toBe('http://localhost:4200/api/v1');
  });
});

describe('resolveToken', () => {
  it('prefers DEPLLO_TOKEN from the env', () => {
    process.env.DEPLLO_TOKEN = 'tok_123';
    expect(resolveToken()).toBe('tok_123');
  });

  it('returns null when no token is available', () => {
    delete process.env.DEPLLO_TOKEN;
    // No session file in the test env → null (HOME points at a tmp dir in CI).
    process.env.HOME = '/nonexistent-depllo-test-home';
    expect(resolveToken()).toBeNull();
  });
});
