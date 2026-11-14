import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthRateLimitGuard } from '../src/auth/auth-rate-limit.guard.js';
import { SessionService } from '../src/auth/session.service.js';

let app: INestApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
});

describe('authentication abuse protection', () => {
  it.each(['login', 'register'])(
    'returns 429 before invoking %s service after the limit',
    async (action) => {
      vi.stubEnv(
        action === 'login' ? 'AUTH_LOGIN_IP_LIMIT' : 'AUTH_REGISTER_IP_LIMIT',
        '2',
      );
      const register = vi.fn().mockResolvedValue({
        id: 1,
        name: 'Tester',
        email: 'test@example.test',
      });
      const loginWithSession = vi.fn().mockResolvedValue({
        user: { id: 1, name: 'Tester', email: 'test@example.test' },
        token: 'fake',
        expiresAt: new Date(),
      });
      const fixture = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          AuthRateLimitGuard,
          { provide: AuthService, useValue: { register, loginWithSession } },
          { provide: SessionService, useValue: {} },
        ],
      }).compile();
      app = fixture.createNestApplication();
      await app.init();
      const body = {
        email: 'test@example.test',
        password: 'LongPassword123!',
        ...(action === 'register' ? { name: 'Tester' } : {}),
      };
      const status = action === 'login' ? 200 : 201;
      await request(app.getHttpServer())
        .post(`/auth/${action}`)
        .set('X-Forwarded-For', '1.1.1.1')
        .send(body)
        .expect(status);
      await request(app.getHttpServer())
        .post(`/auth/${action}`)
        .set('X-Forwarded-For', '2.2.2.2')
        .send(body)
        .expect(status);
      await request(app.getHttpServer())
        .post(`/auth/${action}`)
        .set('X-Forwarded-For', '3.3.3.3')
        .send(body)
        .expect(429);
      expect(
        action === 'login' ? loginWithSession : register,
      ).toHaveBeenCalledTimes(2);
    },
  );
  it('rejects oversized registration input before the service', async () => {
    const register = vi.fn();
    const fixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthRateLimitGuard,
        { provide: AuthService, useValue: { register } },
        { provide: SessionService, useValue: {} },
      ],
    }).compile();
    app = fixture.createNestApplication();
    await app.init();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'x'.repeat(121),
        email: 'test@example.test',
        password: 'LongPassword123!',
      })
      .expect(400);
    expect(register).not.toHaveBeenCalled();
  });
  it('enforces the IP limit for simultaneous requests', async () => {
    vi.stubEnv('AUTH_LOGIN_IP_LIMIT', '2');
    const loginWithSession = vi
      .fn()
      .mockResolvedValue({
        user: { id: 1, name: 'Tester', email: 'test@example.test' },
        token: 'fake',
        expiresAt: new Date(),
      });
    const fixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthRateLimitGuard,
        { provide: AuthService, useValue: { loginWithSession } },
        { provide: SessionService, useValue: {} },
      ],
    }).compile();
    app = fixture.createNestApplication();
    await app.init();
    const server = app.getHttpServer();
    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(server)
          .post('/auth/login')
          .send({
            email: `user${i}@example.test`,
            password: 'LongPassword123!',
          }),
      ),
    );
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(2);
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(3);
    expect(loginWithSession).toHaveBeenCalledTimes(2);
  });
});
