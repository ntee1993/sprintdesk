import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import { Prisma } from '../generated/prisma/client.js';

export type CreateTaskInput = {
  title: string;
  status: string;
  priority: string;
  projectId: number;
  assigneeId?: number | null;
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: ListTasksQueryDto = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = filters.sortBy ?? 'id';
    const order = filters.order === 'desc' ? 'desc' : 'asc';

    return this.prisma.task.findMany({
      where: {
        status: filters.status,
        priority: filters.priority,
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: order,
      },
    });
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

  async create(task: CreateTaskInput) {
    try {
      return await this.prisma.task.create({
        data: task,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('Invalid task relation');
      }

      throw error;
    }
  }

  async update(id: number, changes: UpdateTaskDto) {
    try {
      return await this.prisma.task.update({
        where: { id },
        data: changes,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Task not found');
        }
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid task relation');
        }
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
