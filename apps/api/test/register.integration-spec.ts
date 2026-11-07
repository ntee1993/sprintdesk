import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { verifyPassword } from '../src/auth/password.js';

describe('Registration Integration', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    const url = new URL(databaseUrl);

    if (
      url.pathname !== '/sprintdesk_test' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '5433'
    ) {
      throw new Error('Unsafe integration test database');
    }

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const prismaService = app.get(PrismaService);
    prisma = prismaService;

    const result = await prismaService.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;

    if (result[0]?.name !== 'sprintdesk_test') {
      throw new Error('Connected to an unexpected database');
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registers a user and stores an Argon2id hash in PostgreSQL', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `register-${randomUUID()}@example.test`;
    const password = 'MySecurePassword123!';

    try {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Integration Tester',
          email,
          password,
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        name: 'Integration Tester',
        email,
      });
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');

      const savedUser = await prisma.user.findUnique({
        where: { email },
      });

      expect(savedUser).not.toBeNull();

      if (!savedUser) {
        throw new Error('Registered user was not found');
      }

      const passwordHash = savedUser.passwordHash;

      expect(passwordHash).not.toBeNull();

      if (passwordHash === null) {
        throw new Error('Registered user has no password hash');
      }

      expect(passwordHash).not.toBe(password);
      expect(passwordHash).toMatch(/^\$argon2id\$/);

      expect(await verifyPassword(passwordHash, password)).toBe(true);
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });

  it('rejects duplicate email and preserves the original user', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `duplicate-${randomUUID()}@example.test`;
    const firstPassword = 'FirstPassword123!';
    const secondPassword = 'SecondPassword123!';

    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'First User',
          email,
          password: firstPassword,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Second User',
          email,
          password: secondPassword,
        })
        .expect(409);

      expect(response.body.message).toBe('Email already registered');

      const count = await prisma.user.count({
        where: { email },
      });

      expect(count).toBe(1);

      const savedUser = await prisma.user.findUnique({
        where: { email },
      });

      expect(savedUser).not.toBeNull();

      if (!savedUser) {
        throw new Error('Original user was not found');
      }

      const passwordHash = savedUser.passwordHash;

      expect(passwordHash).not.toBeNull();

      if (passwordHash === null) {
        throw new Error('Original user has no password hash');
      }

      expect(await verifyPassword(passwordHash, firstPassword)).toBe(true);
      expect(await verifyPassword(passwordHash, secondPassword)).toBe(false);
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });
});
