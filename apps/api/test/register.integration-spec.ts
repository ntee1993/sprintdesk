import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
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
    app.use(cookieParser());
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

  it('logs in a registered user with valid credentials', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `login-${randomUUID()}@example.test`;
    const password = 'MySecurePassword123!';

    try {
      const registration = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Login Tester',
          email,
          password,
        })
        .expect(201);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(login.body).toEqual({
        id: registration.body.id,
        name: registration.body.name,
        email: registration.body.email,
      });
      expect(login.body).not.toHaveProperty('password');
      expect(login.body).not.toHaveProperty('passwordHash');
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });

  it('rejects login with an unknown email', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `unknown-${randomUUID()}@example.test`;

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email,
        password: 'MySecurePassword123!',
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password');
  });

  it('rejects an incorrect password for an existing user', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `wrong-password-${randomUUID()}@example.test`;
    const correctPassword = 'CorrectPassword123!';

    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Password Test User',
          email,
          password: correctPassword,
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.message).toBe('Invalid email or password');

      const savedUser = await prisma.user.findUnique({
        where: { email },
      });

      expect(savedUser).not.toBeNull();
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });

  it('completes the register, login, session and logout flow', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const email = `session-flow-${randomUUID()}@example.test`;
    const password = 'MySecurePassword123!';

    try {
      const registration = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Session Flow Tester',
          email,
          password,
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(loginResponse.body).toEqual({
        id: registration.body.id,
        name: registration.body.name,
        email: registration.body.email,
      });
      expect(loginResponse.body).not.toHaveProperty('token');
      expect(loginResponse.body).not.toHaveProperty('expiresAt');

      const setCookie = loginResponse.headers['set-cookie']?.[0];

      expect(setCookie).toContain('HttpOnly');

      if (!setCookie) {
        throw new Error('Login response did not set a session cookie');
      }

      const sessionCookie = setCookie.split(';')[0];

      const meResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200);

      expect(meResponse.body).toEqual({
        id: registration.body.id,
        name: registration.body.name,
        email: registration.body.email,
      });

      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(204);

      expect(logoutResponse.headers['set-cookie']?.[0]).toContain(
        'sprintdesk_session=;',
      );

      const revokedSessionResponse = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', sessionCookie)
        .expect(401);

      expect(revokedSessionResponse.body.message).toBe('Unauthenticated');
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });

  it('prevents a non-member from reading or updating another project task', async () => {
    if (!app || !prisma) {
      throw new Error('Application was not initialized');
    }

    const ownerEmail = `project-owner-${randomUUID()}@example.test`;
    const outsiderEmail = `project-outsider-${randomUUID()}@example.test`;
    const password = 'MySecurePassword123!';
    let projectId: number | undefined;

    try {
      const owner = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Project Owner', email: ownerEmail, password })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ name: 'Project Outsider', email: outsiderEmail, password })
        .expect(201);

      const project = await prisma.project.create({
        data: {
          name: 'Private Integration Project',
          ownerId: owner.body.id,
        },
      });
      projectId = project.id;

      const task = await prisma.task.create({
        data: {
          title: 'Private Task',
          status: 'todo',
          priority: 'high',
          projectId,
        },
      });

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: outsiderEmail, password })
        .expect(200);
      const setCookie = login.headers['set-cookie']?.[0];

      if (!setCookie) {
        throw new Error('Login response did not set a session cookie');
      }

      const sessionCookie = setCookie.split(';')[0];

      await request(app.getHttpServer())
        .get(`/tasks/${task.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/tasks/${task.id}`)
        .set('Cookie', sessionCookie)
        .send({ status: 'done' })
        .expect(404);

      const savedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      expect(savedTask).toMatchObject({
        id: task.id,
        title: 'Private Task',
        status: 'todo',
      });
    } finally {
      if (projectId !== undefined) {
        await prisma.task.deleteMany({ where: { projectId } });
        await prisma.project.deleteMany({ where: { id: projectId } });
      }

      await prisma.user.deleteMany({
        where: { email: { in: [ownerEmail, outsiderEmail] } },
      });
    }
  });
});
