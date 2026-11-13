import { Module } from '@nestjs/common';
import { TaskCommentsController } from './task-comments.controller.js';
import { TaskCommentsService } from './task-comments.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectAuthorizationService } from '../auth/project-authorization.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TasksController, TaskCommentsController],
  providers: [TasksService, TaskCommentsService, ProjectAuthorizationService],
})
export class TasksModule {}
