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

// Public test value, not an account credential. Match the current Argon2id policy.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$ujHHtyJFrAO//bg/hJ0RBA$Lvx95vf4XWdjPLRI1L7ExJ+I4XQ9aLAWxJnDQjOEPro';

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

    // Unknown and legacy users still perform Argon2 verification; never accept
    // the dummy hash as a credential for an absent account.
    const isPasswordValid = await verifyPassword(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      dto.password,
    );

    if (user === null || user.passwordHash === null || !isPasswordValid) {
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
