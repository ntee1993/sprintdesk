import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password utilities', () => {
  it('hashes a password with Argon2id', async () => {
    const password = 'MySecurePassword123!';

    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('uses a random salt for each hash', async () => {
    const password = 'MySecurePassword123!';

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it('verifies correct and incorrect passwords', async () => {
    const password = 'MySecurePassword123!';
    const hash = await hashPassword(password);

    const correct = await verifyPassword(hash, password);
    const incorrect = await verifyPassword(hash, 'WrongPassword123!');

    expect(correct).toBe(true);
    expect(incorrect).toBe(false);
  });
});
