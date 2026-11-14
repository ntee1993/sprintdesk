import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getCorsOrigin } from '../cors.config.js';
import { matchesCsrfToken } from './csrf.js';
import { SessionService } from '../auth/session.service.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
    const trusted = getCorsOrigin();
    const origin = req.get('origin');
    const referer = req.get('referer');
    let source = origin;
    if (source === undefined && referer) {
      try {
        source = new URL(referer).origin;
      } catch {
        source = '';
      }
    }
    if (source !== trusted || req.get('sec-fetch-site') === 'cross-site')
      throw new ForbiddenException('Invalid request origin');
    const session: unknown = (
      req.cookies as Record<string, unknown> | undefined
    )?.sprintdesk_session;
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const isCredentialEndpoint =
      controller === 'AuthController' &&
      (handler === 'login' || handler === 'register');
    if (
      !isCredentialEndpoint &&
      typeof session === 'string' &&
      session.length > 0 &&
      !matchesCsrfToken(session, req.get('x-csrf-token'))
    ) {
      const isLogout = controller === 'AuthController' && handler === 'logout';
      if (!isLogout || (await this.sessions.validateSession(session)) !== null)
        throw new ForbiddenException('Invalid CSRF token');
    }
    return true;
  }
}
