import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { lockProject } from '../prisma/project-lock.js';

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
        projectId: filters.projectId,
        project: {
          is: {
            OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
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
            OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
          },
        },
      },
    });
    if (task === null) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async validateAssignee(
    projectId: number,
    assigneeId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: assigneeId },
          { memberships: { some: { userId: assigneeId } } },
        ],
      },
      select: { id: true },
    });

    if (project === null) {
      throw new BadRequestException('Assignee must belong to the project');
    }
  }

  async create(task: CreateTaskInput, userId: number) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockProject(tx, task.projectId);
          const project = await tx.project.findFirst({
            where: {
              id: task.projectId,
              OR: [
                { ownerId: userId },
                { memberships: { some: { userId, role: 'EDITOR' } } },
              ],
            },
            select: { id: true },
          });
          if (!project)
            throw new ForbiddenException('Insufficient project permission');
          if (task.assigneeId != null) {
            await this.validateAssignee(task.projectId, task.assigneeId, tx);
          }
          return tx.task.create({ data: task });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
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
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.task.findFirst({
            where: { id },
            select: { projectId: true },
          });
          if (!current) throw new NotFoundException('Task not found');
          await lockProject(tx, current.projectId);
          const where: Prisma.TaskWhereInput = {
            id,
            project: {
              is: {
                OR: [
                  { ownerId: userId },
                  { memberships: { some: { userId, role: 'EDITOR' } } },
                ],
              },
            },
          };
          const existing = await tx.task.findFirst({
            where,
            select: { projectId: true },
          });
          if (!existing) throw new NotFoundException('Task not found');
          if (changes.assigneeId != null) {
            await this.validateAssignee(
              existing.projectId,
              changes.assigneeId,
              tx,
            );
          }
          const tasks = await tx.task.updateManyAndReturn({
            where,
            data: changes,
          });
          if (!tasks[0]) throw new NotFoundException('Task not found');
          return tasks[0];
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
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
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.task.findFirst({
          where: { id },
          select: { projectId: true },
        });
        if (!current) throw new NotFoundException('Task not found');
        await lockProject(tx, current.projectId);
        const task = await tx.task.findFirst({ where });
        if (!task) throw new NotFoundException('Task not found');
        const { count } = await tx.task.deleteMany({ where });
        if (!count) throw new NotFoundException('Task not found');
        return task;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
