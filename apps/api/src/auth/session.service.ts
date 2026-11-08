import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  generateSessionToken,
  hashSessionToken,
} from './session-token.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: number) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async validateSession(token: string) {
    const tokenHash = hashSessionToken(token);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return session.user;
  }

  async revokeSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        tokenHash: hashSessionToken(token),
      },
    });
  }
}
