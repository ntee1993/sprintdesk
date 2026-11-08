import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionService } from './session.service.js';
import { hashSessionToken } from './session-token.js';

describe('SessionService', () => {
  let sessionService: SessionService;
  let createSessionMock: ReturnType<typeof vi.fn>;
  let findUniqueMock: ReturnType<typeof vi.fn>;
  let deleteManyMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createSessionMock = vi.fn();
    findUniqueMock = vi.fn();
    deleteManyMock = vi.fn();

    const prismaMock = {
      session: {
        create: createSessionMock,
        findUnique: findUniqueMock,
        deleteMany: deleteManyMock,
      },
    };

    sessionService = new SessionService(
      prismaMock as unknown as PrismaService,
    );
  });

  it('creates a session and stores only the token hash', async () => {
    createSessionMock.mockResolvedValue({});

    const result = await sessionService.createSession(1);

    expect(createSessionMock).toHaveBeenCalledOnce();

    const createArgs = createSessionMock.mock.calls[0][0];

    expect(createArgs.data.userId).toBe(1);
    expect(createArgs.data.tokenHash).toBe(hashSessionToken(result.token));
    expect(createArgs.data.tokenHash).not.toBe(result.token);
    expect(result).toEqual({
      token: expect.any(String),
      expiresAt: expect.any(Date),
    });
  });

  it('sets the session expiration to seven days', async () => {
    const fixedNow = new Date('2026-11-08T00:00:00.000Z');
    const expectedExpiry = new Date(
      fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      createSessionMock.mockResolvedValue({});

      const result = await sessionService.createSession(1);
      const createArgs = createSessionMock.mock.calls[0][0];

      expect(result.expiresAt).toEqual(expectedExpiry);
      expect(createArgs.data.expiresAt).toEqual(expectedExpiry);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not return a token when session creation fails', async () => {
    const error = new Error('Database unavailable');
    createSessionMock.mockRejectedValue(error);

    await expect(sessionService.createSession(1)).rejects.toBe(error);
  });

  it('returns the user for a valid session', async () => {
    const token = 'example-session-token';
    const user = {
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
    };

    findUniqueMock.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });

    const result = await sessionService.validateSession(token);

    expect(result).toEqual(user);
    expect(findUniqueMock).toHaveBeenCalledExactlyOnceWith({
      where: {
        tokenHash: hashSessionToken(token),
      },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });

  it('returns null when the session does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      sessionService.validateSession('unknown-session-token'),
    ).resolves.toBeNull();
  });

  it('returns null when the session has expired', async () => {
    const fixedNow = new Date('2026-11-08T00:00:00.000Z');

    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    try {
      findUniqueMock.mockResolvedValue({
        expiresAt: fixedNow,
        user: {
          id: 1,
          name: 'Tester',
          email: 'tester@example.test',
        },
      });

      await expect(
        sessionService.validateSession('expired-session-token'),
      ).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('revokes a session using its token hash', async () => {
    const token = 'example-session-token';
    deleteManyMock.mockResolvedValue({ count: 1 });

    await sessionService.revokeSession(token);

    expect(deleteManyMock).toHaveBeenCalledExactlyOnceWith({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  });
});
