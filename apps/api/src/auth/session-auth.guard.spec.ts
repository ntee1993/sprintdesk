import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionAuthGuard } from './session-auth.guard.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { SessionService } from './session.service.js';

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let validateSessionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    validateSessionMock = vi.fn();

    guard = new SessionAuthGuard({
      validateSession: validateSessionMock,
    } as unknown as SessionService);
  });

  function createContext(cookies: Record<string, unknown>) {
    const req = { cookies } as unknown as AuthenticatedRequest;

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;

    return { context, req };
  }

  it('rejects requests without a session cookie', async () => {
    const { context } = createContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(validateSessionMock).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid session', async () => {
    const { context } = createContext({
      sprintdesk_session: 'invalid-session-token',
    });
    validateSessionMock.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(validateSessionMock).toHaveBeenCalledExactlyOnceWith(
      'invalid-session-token',
    );
  });

  it('authenticates requests with a valid session', async () => {
    const user = {
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
    };
    const { context, req } = createContext({
      sprintdesk_session: 'test-session-token',
    });
    validateSessionMock.mockResolvedValue(user);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(req.user).toEqual(user);
    expect(validateSessionMock).toHaveBeenCalledExactlyOnceWith(
      'test-session-token',
    );
  });
});
