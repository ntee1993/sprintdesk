import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
})
export class AuthModule {}
