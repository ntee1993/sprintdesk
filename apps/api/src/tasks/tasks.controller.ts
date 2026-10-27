import { Controller, Get, Post, Body } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import type { CreateTaskInput } from './tasks.service.js';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Post()
  create(@Body() body: CreateTaskInput) {
    return this.tasksService.create(body);
  }
}
