import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken } from './session-token.js';

describe('session token utilities', () => {
  it('generates a secure 32-byte session token', () => {
    const token = generateSessionToken();

    expect(typeof token).toBe('string');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  it('generates different tokens on consecutive calls', () => {
    const firstToken = generateSessionToken();
    const secondToken = generateSessionToken();

    expect(firstToken).not.toBe(secondToken);
  });

  it('hashes session tokens consistently using SHA-256', () => {
    const token = 'abc';
    const expectedHash =
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

    const firstHash = hashSessionToken(token);
    const secondHash = hashSessionToken(token);

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(firstHash).not.toBe(token);
    expect(firstHash).toBe(expectedHash);
  });
});
