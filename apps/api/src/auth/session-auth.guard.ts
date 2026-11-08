import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionService } from './session.service.js';

export type AuthenticatedRequest = Request & {
  user: {
    id: number;
    name: string;
    email: string;
  };
};

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.sprintdesk_session;

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const user = await this.sessions.validateSession(token);

    if (user === null) {
      throw new UnauthorizedException('Unauthenticated');
    }

    req.user = user;

    return true;
  }
}
