import { describe, expect, it, vi, afterEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard.js';
import { csrfToken } from './csrf.js';
import type { SessionService } from '../auth/session.service.js';

const guard = () =>
  new CsrfGuard({
    validateSession: vi.fn().mockResolvedValue(null),
  } as unknown as SessionService);

afterEach(() => vi.unstubAllEnvs());
function context(
  origin: string | undefined,
  session?: string,
  token?: string,
  site?: string,
  handler = 'update',
): ExecutionContext {
  const headers: Record<string, string | undefined> = {
    origin,
    'x-csrf-token': token,
    'sec-fetch-site': site,
  };
  return {
    getClass: () => ({ name: 'TasksController' }),
    getHandler: () => ({ name: handler }),
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'PATCH',
        cookies: { sprintdesk_session: session },
        get: (name: string) => headers[name],
      }),
    }),
  } as unknown as ExecutionContext;
}
describe('CSRF protection', () => {
  it('accepts a trusted origin and session-bound token', async () => {
    await expect(
      guard().canActivate(
        context('http://localhost:5173', 'session', csrfToken('session')),
      ),
    ).resolves.toBe(true);
  });
  it.each([
    'null',
    'http://sibling.localhost:5173',
    'https://attacker.test',
    undefined,
  ])(
    'rejects untrusted or missing origin %s even with a token',
    async (origin) => {
      await expect(
        guard().canActivate(
          context(origin, 'session', csrfToken('session'), 'same-origin'),
        ),
      ).rejects.toThrow();
    },
  );
  it('rejects missing, invalid and another session token', async () => {
    for (const token of [undefined, 'invalid', csrfToken('other')])
      await expect(
        guard().canActivate(context('http://localhost:5173', 'session', token)),
      ).rejects.toThrow();
  });
  it('rejects cross-site fetch metadata even for a matching origin', async () => {
    await expect(
      guard().canActivate(
        context(
          'http://localhost:5173',
          'session',
          csrfToken('session'),
          'cross-site',
        ),
      ),
    ).rejects.toThrow();
  });
});
