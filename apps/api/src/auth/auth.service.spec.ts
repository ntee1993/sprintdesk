import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { verifyPassword } from './password.js';

describe('AuthService', () => {
  let authService: AuthService;
  let createUserMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createUserMock = vi.fn();

    const prismaMock = {
      user: {
        create: createUserMock,
      },
    };

    authService = new AuthService(prismaMock as unknown as PrismaService);
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
});
