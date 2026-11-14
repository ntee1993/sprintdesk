import { HttpException, type ExecutionContext } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

function context(
  action: 'login' | 'register',
  ip: string,
  email: unknown,
  forwarded?: string,
): ExecutionContext {
  const handler =
    action === 'login' ? function login() {} : function register() {};
  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        socket: { remoteAddress: ip },
        body: { email },
        headers: { 'x-forwarded-for': forwarded },
      }),
    }),
  } as unknown as ExecutionContext;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('AuthRateLimitGuard', () => {
  it('limits normalized account and IP pairs and resets after the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    vi.stubEnv('AUTH_LOGIN_ACCOUNT_IP_LIMIT', '2');
    const guard = new AuthRateLimitGuard();
    const request = context('login', 'client-a', ' USER@example.test ');
    expect(guard.canActivate(request)).toBe(true);
    expect(
      guard.canActivate(context('login', 'client-a', 'user@example.test')),
    ).toBe(true);
    expect(() => guard.canActivate(request)).toThrow(HttpException);
    expect(
      guard.canActivate(context('login', 'client-b', 'user@example.test')),
    ).toBe(true);
    expect(
      guard.canActivate(context('login', 'client-a', 'other@example.test')),
    ).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(guard.canActivate(request)).toBe(true);
  });

  it('ignores X-Forwarded-For when enforcing the IP limit', () => {
    vi.stubEnv('AUTH_LOGIN_IP_LIMIT', '2');
    const guard = new AuthRateLimitGuard();
    guard.canActivate(
      context('login', 'client-a', 'one@example.test', '1.1.1.1'),
    );
    guard.canActivate(
      context('login', 'client-a', 'two@example.test', '2.2.2.2'),
    );
    expect(() =>
      guard.canActivate(
        context('login', 'client-a', 'three@example.test', '3.3.3.3'),
      ),
    ).toThrow(HttpException);
    expect(
      guard.canActivate(context('login', 'client-b', 'one@example.test')),
    ).toBe(true);
  });

  it('bounds pair storage without denying new clients when pair capacity is full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    vi.stubEnv('AUTH_LOGIN_IP_LIMIT', '20000');
    vi.stubEnv('AUTH_LOGIN_ACCOUNT_IP_LIMIT', '1');
    const guard = new AuthRateLimitGuard();
    const stores = guard as unknown as {
      ipBuckets: { entries: Map<string, unknown> };
      accountBuckets: { entries: Map<string, unknown> };
    };
    for (let i = 0; i < 10_000; i++)
      guard.canActivate(context('login', 'client-a', `user${i}@example.test`));
    expect(stores.accountBuckets.entries.size).toBe(10_000);
    expect(() =>
      guard.canActivate(context('login', 'client-a', 'user0@example.test')),
    ).toThrow(HttpException);
    expect(
      guard.canActivate(context('login', 'client-b', 'new@example.test')),
    ).toBe(true);
    expect(stores.accountBuckets.entries.size).toBe(10_000);
    expect(
      [...stores.accountBuckets.entries.keys()].some((key) =>
        key.includes('example.test'),
      ),
    ).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(
      guard.canActivate(context('login', 'client-c', 'new@example.test')),
    ).toBe(true);
    expect(stores.accountBuckets.entries.size).toBe(1);
  });

  it('does not allocate pair buckets for malformed email and recovers when IP buckets expire', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const guard = new AuthRateLimitGuard();
    const stores = guard as unknown as {
      ipBuckets: { entries: Map<string, unknown> };
      accountBuckets: { entries: Map<string, unknown> };
    };
    for (let i = 0; i < 10_000; i++)
      guard.canActivate(context('login', `client-${i}`, `invalid-${i}`));
    expect(stores.ipBuckets.entries.size).toBe(10_000);
    expect(stores.accountBuckets.entries.size).toBe(0);
    expect(() =>
      guard.canActivate(context('login', 'new-client', 'valid@example.test')),
    ).toThrow(HttpException);
    vi.advanceTimersByTime(60_000);
    expect(
      guard.canActivate(context('login', 'new-client', 'valid@example.test')),
    ).toBe(true);
    expect(stores.ipBuckets.entries.size).toBe(1);
  });

  it('fails closed for invalid configuration', () => {
    vi.stubEnv('AUTH_RATE_WINDOW_MS', '0');
    expect(() => new AuthRateLimitGuard()).toThrow(
      'AUTH_RATE_WINDOW_MS must be a positive integer',
    );
  });
});
