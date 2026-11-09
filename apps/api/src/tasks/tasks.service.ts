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

  findAll(filters: ListTasksQueryDto, userId: number) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = filters.sortBy ?? 'id';
    const order = filters.order === 'desc' ? 'desc' : 'asc';

    return this.prisma.task.findMany({
      where: {
        status: filters.status,
        priority: filters.priority,
        project: {
          is: {
            OR: [
              { ownerId: userId },
              { memberships: { some: { userId } } },
            ],
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: order,
      },
    });
  }

  async findOne(id: number, userId: number) {
    const task = await this.prisma.task.findFirst({
      where: {
        id,
        project: {
          is: {
            OR: [
              { ownerId: userId },
              { memberships: { some: { userId } } },
            ],
          },
        },
      },
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

  async update(id: number, changes: UpdateTaskDto, userId: number) {
    try {
      const tasks = await this.prisma.task.updateManyAndReturn({
        where: {
          id,
          project: {
            is: {
              OR: [
                { ownerId: userId },
                {
                  memberships: {
                    some: { userId, role: 'EDITOR' },
                  },
                },
              ],
            },
          },
        },
        data: changes,
      });

      const task = tasks[0];

      if (task === undefined) {
        throw new NotFoundException('Task not found');
      }

      return task;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException('Invalid task relation');
        }
      }

      throw error;
    }
  }

  async remove(id: number, userId: number) {
    const where: Prisma.TaskWhereInput = {
      id,
      project: {
        is: {
          OR: [
            { ownerId: userId },
            {
              memberships: {
                some: { userId, role: 'EDITOR' },
              },
            },
          ],
        },
      },
    };
    const task = await this.prisma.task.findFirst({ where });

    if (task === null) {
      throw new NotFoundException('Task not found');
    }

    const { count } = await this.prisma.task.deleteMany({ where });

    if (count === 0) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }
}
