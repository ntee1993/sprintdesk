import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { Prisma } from '../generated/prisma/client.js';

export type CreateTaskInput = {
  title: string;
  status: string;
  priority: string;
  projectId: number;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

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

  async update(id: number, changes: UpdateTaskDto) {
    try {
      return await this.prisma.task.update({
        where: { id },
        data: changes,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Task not found');
      }

      throw error;
    }
  }

  async remove(id: number) {
    try {
      return await this.prisma.task.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Task not found');
      }

      throw error;
    }
  }
}
