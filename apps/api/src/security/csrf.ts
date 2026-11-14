import { createHmac, timingSafeEqual } from 'node:crypto';

// A random session token is the HMAC key; the result cannot be used as a session cookie.
export function csrfToken(session: string): string {
  return createHmac('sha256', session)
    .update('sprintdesk-csrf-v1')
    .digest('hex');
}
export function matchesCsrfToken(session: string, token: unknown): boolean {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(
    Buffer.from(csrfToken(session), 'hex'),
    Buffer.from(token, 'hex'),
  );
}
