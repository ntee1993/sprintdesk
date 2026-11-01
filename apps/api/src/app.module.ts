import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { TasksModule } from './tasks/tasks.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [TasksModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
