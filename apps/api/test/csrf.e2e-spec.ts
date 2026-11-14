import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SessionService } from '../src/auth/session.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ProjectsService } from '../src/projects/projects.service.js';

const origin = 'http://localhost:5173';
const cookie = 'sprintdesk_session=test-session';
let app: INestApplication;
let create: ReturnType<typeof vi.fn>;
let revoke: ReturnType<typeof vi.fn>;
let login: ReturnType<typeof vi.fn>;
let validateSession: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  create = vi.fn().mockResolvedValue({ id: 1, ownerId: 1, name: 'Project' });
  revoke = vi.fn().mockResolvedValue(undefined);
  validateSession = vi
    .fn()
    .mockResolvedValue({ id: 1, name: 'User', email: 'user@example.test' });
  login = vi.fn().mockResolvedValue({
    user: { id: 1, name: 'User', email: 'user@example.test' },
    token: 'new-session',
    expiresAt: new Date(Date.now() + 1000),
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(SessionService)
    .useValue({
      validateSession,
      revokeSession: revoke,
    })
    .overrideProvider(AuthService)
    .useValue({
      loginWithSession: login,
      register: vi.fn().mockResolvedValue({ id: 1 }),
    })
    .overrideProvider(ProjectsService)
    .useValue({ create })
    .compile();
  app = module.createNestApplication();
  app.use(cookieParser());
  await app.init();
});
afterEach(async () => {
  await app.close();
});

describe('CSRF HTTP protection', () => {
  it('requires a session-bound token for a trusted-origin write', async () => {
    const tokenResponse = await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(200);
    expect(tokenResponse.headers['cache-control']).toContain('no-store');
    const token = tokenResponse.body.token;
    await request(app.getHttpServer())
      .post('/projects')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ name: 'Project' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/projects')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', token)
      .send({ name: 'Project' })
      .expect(201);
    expect(create).toHaveBeenCalledOnce();
  });
  it.each(['null', 'http://sibling.localhost:5173', 'https://evil.test'])(
    'rejects origin %s even with fetch metadata',
    async (untrusted) => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', untrusted)
        .set('Sec-Fetch-Site', 'same-origin')
        .send({ email: 'user@example.test', password: 'Password123!' })
        .expect(403);
      expect(login).not.toHaveBeenCalled();
    },
  );
  it('rejects missing origin and permits an exact trusted referer', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@example.test', password: 'Password123!' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Referer', `${origin}/login`)
      .send({ email: 'user@example.test', password: 'Password123!' })
      .expect(200);
  });
  it('protects logout and permits a token-bound logout', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', body.token)
      .expect(204);
    expect(revoke).toHaveBeenCalledOnce();
  });
  it('rejects untrusted registration and cross-site metadata', async () => {
    const body = {
      name: 'Tester',
      email: 'test@example.test',
      password: 'Password123!',
    };
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'https://evil.test')
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .set('Sec-Fetch-Site', 'cross-site')
      .send(body)
      .expect(403);
  });
  it('does not accept a token issued for another session', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/projects')
      .set('Origin', origin)
      .set('Cookie', 'sprintdesk_session=other-session')
      .set('X-CSRF-Token', body.token)
      .send({ name: 'Project' })
      .expect(403);
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects revoked session tokens and denies token retrieval', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(200);
    revoke.mockImplementation(async () => {
      validateSession.mockResolvedValue(null);
    });
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', body.token)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(401);
    await request(app.getHttpServer())
      .post('/projects')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .set('X-CSRF-Token', body.token)
      .send({ name: 'Project' })
      .expect(401);
    expect(create).not.toHaveBeenCalled();
  });
  it('allows an expired session to be cleared and a new login', async () => {
    validateSession.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/auth/csrf')
      .set('Cookie', cookie)
      .expect(401);
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(204);
    expect(response.headers['set-cookie']?.[0]).toContain(
      'sprintdesk_session=;',
    );
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .send({ email: 'user@example.test', password: 'Password123!' })
      .expect(200);
  });
  it('fails closed if validating an invalid logout token encounters a database error', async () => {
    validateSession.mockRejectedValue(new Error('database unavailable'));
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Origin', origin)
      .set('Cookie', cookie)
      .expect(500);
    expect(revoke).not.toHaveBeenCalled();
  });
  it('does not use Referer to override an explicitly untrusted Origin', async () => {
    const body = { email: 'user@example.test', password: 'Password123!' };
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'null')
      .set('Referer', `${origin}/login`)
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Referer', 'https://evil.test/')
      .send(body)
      .expect(403);
    expect(login).not.toHaveBeenCalled();
  });
  it('does not log session cookies or CSRF tokens', async () => {
    const spy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    try {
      const { body } = await request(app.getHttpServer())
        .get('/auth/csrf')
        .set('Cookie', cookie)
        .expect(200);
      await request(app.getHttpServer())
        .post('/projects')
        .set('Origin', origin)
        .set('Cookie', cookie)
        .set('X-CSRF-Token', body.token)
        .send({ name: 'Project' })
        .expect(201);
      expect(spy).toHaveBeenCalled();
      const logs = JSON.stringify(spy.mock.calls);
      expect(logs).not.toContain(body.token);
      expect(logs).not.toContain('test-session');
    } finally {
      spy.mockRestore();
    }
  });
});
