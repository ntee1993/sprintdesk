import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';

@Module({
  controllers: [TasksController],
  providers: [],
})
export class TasksModule {}
