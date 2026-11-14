import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { isEmail } from 'class-validator';

type Bucket = { count: number; expiresAt: number };
type BucketStore = { entries: Map<string, Bucket>; earliestExpiry: number };
const MAX_BUCKETS = 10_000;

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(raw);
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly key = randomBytes(32);
  private readonly ipBuckets: BucketStore = {
    entries: new Map(),
    earliestExpiry: Infinity,
  };
  private readonly accountBuckets: BucketStore = {
    entries: new Map(),
    earliestExpiry: Infinity,
  };
  private readonly windowMs = positiveInt('AUTH_RATE_WINDOW_MS', 60_000);
  private readonly limits = {
    login: {
      ip: positiveInt('AUTH_LOGIN_IP_LIMIT', 30),
      account: positiveInt('AUTH_LOGIN_ACCOUNT_IP_LIMIT', 10),
    },
    register: {
      ip: positiveInt('AUTH_REGISTER_IP_LIMIT', 10),
      account: positiveInt('AUTH_REGISTER_ACCOUNT_IP_LIMIT', 5),
    },
  };

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const action = context.getHandler().name === 'login' ? 'login' : 'register';
    // Socket address is supplied by the transport; forwarded headers are never trusted.
    const ip = req.socket.remoteAddress ?? 'unknown';
    const email: unknown = (req.body as Record<string, unknown> | undefined)
      ?.email;
    const normalized =
      typeof email === 'string' && email.length <= 254
        ? email.trim().toLowerCase()
        : '';
    const validEmail = normalized && isEmail(normalized) ? normalized : '';
    const digest = (value: string) =>
      createHmac('sha256', this.key).update(value).digest('hex');
    const ipKey = `${action}:ip:${digest(ip)}`;
    const accountKey = validEmail
      ? `${action}:pair:${digest(`${ip}\0${validEmail}`)}`
      : undefined;
    const now = performance.now();
    this.check(this.ipBuckets, ipKey, this.limits[action].ip, now, true);
    if (accountKey)
      this.check(
        this.accountBuckets,
        accountKey,
        this.limits[action].account,
        now,
        false,
      );
    return true;
  }

  private check(
    store: BucketStore,
    key: string,
    limit: number,
    now: number,
    required: boolean,
  ): void {
    const buckets = store.entries;
    let bucket = buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      if (!bucket && buckets.size >= MAX_BUCKETS) {
        if (now >= store.earliestExpiry) {
          store.earliestExpiry = Infinity;
          for (const [id, entry] of buckets) {
            if (entry.expiresAt <= now) buckets.delete(id);
            else
              store.earliestExpiry = Math.min(
                store.earliestExpiry,
                entry.expiresAt,
              );
          }
        }
        if (buckets.size >= MAX_BUCKETS && !required) return;
        if (buckets.size >= MAX_BUCKETS)
          throw new HttpException(
            'Too many requests',
            HttpStatus.TOO_MANY_REQUESTS,
          );
      }
      bucket = { count: 0, expiresAt: now + this.windowMs };
      buckets.set(key, bucket);
      store.earliestExpiry = Math.min(store.earliestExpiry, bucket.expiresAt);
    }
    if (bucket.count >= limit)
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    bucket.count++;
  }
}
