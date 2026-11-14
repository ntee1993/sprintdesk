import {
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { RequestLoggingMiddleware } from './logging/request-logging.middleware.js';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { SafeExceptionFilter } from './security/safe-exception.filter.js';
import { SecurityHeadersMiddleware } from './security/security-headers.middleware.js';
import { CsrfGuard } from './security/csrf.guard.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TasksModule } from './tasks/tasks.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';

@Module({
  imports: [TasksModule, PrismaModule, AuthModule, ProjectsModule],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: SafeExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggingMiddleware, SecurityHeadersMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
