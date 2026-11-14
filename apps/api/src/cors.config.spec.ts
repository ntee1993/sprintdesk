import { describe, expect, it, vi, afterEach } from 'vitest';
import { getCorsOrigin } from './cors.config.js';

describe('CORS origin configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to the local frontend', () => {
    vi.stubEnv('CORS_ORIGIN', undefined);
    expect(getCorsOrigin()).toBe('http://localhost:5173');
  });

  it('accepts an explicit HTTPS origin', () => {
    expect(getCorsOrigin('https://app.example.test')).toBe(
      'https://app.example.test',
    );
  });

  it.each([
    '*',
    'https://*.example.test',
    '',
    'null',
    'https://example.test/path',
    'https://user:pass@example.test',
    'file:///tmp',
    'https://one.test,https://two.test',
  ])('rejects invalid origin %s', (origin) => {
    expect(() => getCorsOrigin(origin)).toThrow(
      'CORS_ORIGIN must be a single valid HTTP(S) origin',
    );
  });
});
