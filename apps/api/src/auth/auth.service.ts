import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from './password.js';
import { SessionService } from './session.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
      },
    });

    if (user === null || user.passwordHash === null) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async loginWithSession(dto: LoginDto) {
    const user = await this.login(dto);
    const { token, expiresAt } = await this.sessions.createSession(user.id);

    return { user, token, expiresAt };
  }
}
