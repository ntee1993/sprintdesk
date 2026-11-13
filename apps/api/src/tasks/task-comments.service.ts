import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockProject } from '../prisma/project-lock.js';

const commentSelect = {
  id: true,
  taskId: true,
  authorId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} satisfies Prisma.TaskCommentSelect;

@Injectable()
export class TaskCommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readableTask(taskId: number, userId: number): Prisma.TaskWhereInput {
    return {
      id: taskId,
      project: {
        is: {
          OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
        },
      },
    };
  }

  async findAll(taskId: number, userId: number) {
    const where = this.readableTask(taskId, userId);
    const task = await this.prisma.task.findFirst({
      where,
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.taskComment.findMany({
      where: { taskId, task: { is: where } },
      select: commentSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async withTaskLock<T>(
    taskId: number,
    userId: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await tx.task.findFirst({
          where: { id: taskId },
          select: { projectId: true },
        });
        if (!task) throw new NotFoundException('Task not found');
        await lockProject(tx, task.projectId);
        const accessible = await tx.task.findFirst({
          where: this.readableTask(taskId, userId),
          select: { id: true },
        });
        if (!accessible) throw new NotFoundException('Task not found');
        return action(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  create(taskId: number, userId: number, content: string) {
    return this.withTaskLock(taskId, userId, (tx) =>
      tx.taskComment.create({
        data: { taskId, authorId: userId, content },
        select: commentSelect,
      }),
    );
  }

  update(taskId: number, commentId: number, userId: number, content: string) {
    return this.withTaskLock(taskId, userId, async (tx) => {
      const where = { id: commentId, taskId, authorId: userId };
      const comment = await tx.taskComment.findFirst({
        where,
        select: { id: true },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      return tx.taskComment.update({
        where: { id: comment.id },
        data: { content },
        select: commentSelect,
      });
    });
  }

  remove(taskId: number, commentId: number, userId: number) {
    return this.withTaskLock(taskId, userId, async (tx) => {
      const where = { id: commentId, taskId, authorId: userId };
      const comment = await tx.taskComment.findFirst({
        where,
        select: { id: true },
      });
      if (!comment) throw new NotFoundException('Comment not found');
      return tx.taskComment.delete({
        where: { id: comment.id },
        select: commentSelect,
      });
    });
  }
}
