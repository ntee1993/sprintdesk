import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { SessionService } from './session.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let createUserMock: ReturnType<typeof vi.fn>;
  let findUniqueMock: ReturnType<typeof vi.fn>;
  let createSessionMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createUserMock = vi.fn();
    findUniqueMock = vi.fn();
    createSessionMock = vi.fn();

    const prismaMock = {
      user: {
        create: createUserMock,
        findUnique: findUniqueMock,
      },
    };
    const sessionMock = {
      createSession: createSessionMock,
    };

    authService = new AuthService(
      prismaMock as unknown as PrismaService,
      sessionMock as unknown as SessionService,
    );
  });

  it('registers a user without exposing the password hash', async () => {
    const dto = {
      name: 'Tester',
      email: 'tester@example.test',
      password: 'MySecurePassword123!',
    };
    const createdUser = {
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
    };

    createUserMock.mockResolvedValue(createdUser);

    const result = await authService.register(dto);

    expect(createUserMock).toHaveBeenCalledOnce();

    const createArgs = createUserMock.mock.calls[0][0];
    const passwordHash = createArgs.data.passwordHash;

    expect(createArgs.data.name).toBe(dto.name);
    expect(createArgs.data.email).toBe(dto.email);
    expect(await verifyPassword(passwordHash, dto.password)).toBe(true);

    expect(createArgs.select).toEqual({
      id: true,
      name: true,
      email: true,
    });

    expect(result).toEqual(createdUser);
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictException for duplicate email', async () => {
    const dto = {
      name: 'Tester',
      email: 'tester@example.test',
      password: 'MySecurePassword123!',
    };
    const error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '7.10.1',
      },
    );

    createUserMock.mockRejectedValue(error);

    await expect(authService.register(dto)).rejects.toThrow(ConflictException);
  });

  it('rethrows unexpected database errors', async () => {
    const dto = {
      name: 'Tester',
      email: 'tester@example.test',
      password: 'MySecurePassword123!',
    };
    const error = new Error('Database unavailable');

    createUserMock.mockRejectedValue(error);

    await expect(authService.register(dto)).rejects.toBe(error);
  });

  it('logs in with valid credentials', async () => {
    const password = 'MySecurePassword123!';
    const passwordHash = await hashPassword(password);
    const dto = {
      email: 'tester@example.test',
      password,
    };

    findUniqueMock.mockResolvedValue({
      id: 1,
      name: 'Tester',
      email: dto.email,
      passwordHash,
    });

    const result = await authService.login(dto);

    expect(findUniqueMock).toHaveBeenCalledExactlyOnceWith({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
      },
    });
    expect(result).toEqual({
      id: 1,
      name: 'Tester',
      email: dto.email,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects an unknown email', async () => {
    findUniqueMock.mockResolvedValue(null);

    const login = authService.login({
      email: 'unknown@example.test',
      password: 'MySecurePassword123!',
    });

    await expect(login).rejects.toThrow(UnauthorizedException);
    await expect(login).rejects.toThrow('Invalid email or password');
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await hashPassword('CorrectPassword123!');

    findUniqueMock.mockResolvedValue({
      id: 1,
      name: 'Tester',
      email: 'tester@example.test',
      passwordHash,
    });

    const login = authService.login({
      email: 'tester@example.test',
      password: 'IncorrectPassword123!',
    });

    await expect(login).rejects.toThrow(UnauthorizedException);
    await expect(login).rejects.toThrow('Invalid email or password');
  });

  it('rejects a user without a password hash', async () => {
    findUniqueMock.mockResolvedValue({
      id: 1,
      name: 'Legacy User',
      email: 'legacy@example.test',
      passwordHash: null,
    });

    const login = authService.login({
      email: 'legacy@example.test',
      password: 'MySecurePassword123!',
    });

    await expect(login).rejects.toThrow(UnauthorizedException);
    await expect(login).rejects.toThrow('Invalid email or password');
  });

  it('logs in and creates a session with valid credentials', async () => {
    const password = 'MySecurePassword123!';
    const passwordHash = await hashPassword(password);
    const expiresAt = new Date('2026-11-15T00:00:00.000Z');
    const dto = {
      email: 'tester@example.test',
      password,
    };

    findUniqueMock.mockResolvedValue({
      id: 1,
      name: 'Tester',
      email: dto.email,
      passwordHash,
    });
    createSessionMock.mockResolvedValue({
      token: 'test-session-token',
      expiresAt,
    });

    const result = await authService.loginWithSession(dto);

    expect(createSessionMock).toHaveBeenCalledExactlyOnceWith(1);
    expect(result).toEqual({
      user: {
        id: 1,
        name: 'Tester',
        email: dto.email,
      },
      token: 'test-session-token',
      expiresAt,
    });
  });

  it('does not create a session when login fails', async () => {
    findUniqueMock.mockResolvedValue(null);

    const login = authService.loginWithSession({
      email: 'unknown@example.test',
      password: 'MySecurePassword123!',
    });

    await expect(login).rejects.toThrow(UnauthorizedException);
    await expect(login).rejects.toThrow('Invalid email or password');
    expect(createSessionMock).not.toHaveBeenCalled();
  });
});
