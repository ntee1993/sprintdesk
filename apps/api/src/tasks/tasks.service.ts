import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export type CreateTaskInput = {
  title: string;
  status: string;
  priority: string;
  projectId: number;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private tasks = [
    {
      id: 1,
      title: 'Learn NestJS',
      status: 'todo',
      priority: 'high',
      projectId: 1,
    },
    {
      id: 2,
      title: 'Build Tasks API',
      status: 'in_progress',
      priority: 'urgent',
      projectId: 2,
    },
  ];

  findAll() {
    return this.prisma.task.findMany();
  }

  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });
    if (task === null) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  create(task: CreateTaskInput) {
    return this.prisma.task.create({
      data: task,
    });
  }
}
