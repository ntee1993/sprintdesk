import { Controller, Get } from '@nestjs/common';

@Controller('tasks')
export class TasksController {
  @Get()
  findAll() {
    return [
      {
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
      },
      {
        id: 2,
        title: 'Build Tasks API',
        status: 'in_progress',
        priority: 'urgent',
      },
    ];
  }
}
