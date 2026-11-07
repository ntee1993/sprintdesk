import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword } from './password.js';
import type { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
