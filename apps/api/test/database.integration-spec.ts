import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';

describe('PostgreSQL Integration', () => {
  let prisma: PrismaService | undefined;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    const url = new URL(databaseUrl);

    if (
      url.pathname !== '/sprintdesk_test' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.port !== '5433'
    ) {
      throw new Error('Unsafe integration test database');
    }

    prisma = new PrismaService();
    await prisma.$connect();

    const result = await prisma.$queryRaw<{ name: string }[]>`
    SELECT current_database() AS name
  `;

    if (result[0]?.name !== 'sprintdesk_test') {
      throw new Error('Connected to an unexpected database');
    }
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('connects to the test database', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database() AS name
    `;

    expect(result[0]?.name).toBe('sprintdesk_test');
  });

  it('creates and reads a task from PostgreSQL', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    let userId: number | undefined;
    let projectId: number | undefined;
    let taskId: number | undefined;

    try {
      const user = await prisma.user.create({
        data: {
          name: 'Integration Tester',
          email: `tester-${randomUUID()}@example.test`,
        },
      });
      userId = user.id;

      const project = await prisma.project.create({
        data: {
          name: 'Integration Test Project',
          ownerId: user.id,
        },
      });
      projectId = project.id;

      const task = await prisma.task.create({
        data: {
          title: 'Integration Test Task',
          status: 'todo',
          priority: 'high',
          projectId: project.id,
        },
      });
      taskId = task.id;

      const savedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      expect(savedTask).not.toBeNull();
      expect(savedTask).toMatchObject({
        id: task.id,
        title: 'Integration Test Task',
        status: 'todo',
        projectId: project.id,
      });
    } finally {
      if (taskId !== undefined) {
        await prisma.task.delete({ where: { id: taskId } });
      }

      if (projectId !== undefined) {
        await prisma.project.delete({ where: { id: projectId } });
      }

      if (userId !== undefined) {
        await prisma.user.delete({ where: { id: userId } });
      }
    }
  });

  it('rejects a task with a non-existent project', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    const project = await prisma.project.findUnique({
      where: { id: -1 },
    });

    expect(project).toBeNull();

    await expect(
      prisma.task.create({
        data: {
          title: 'Task With Invalid Project',
          status: 'todo',
          priority: 'high',
          projectId: -1,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('rejects a task with a non-existent assignee', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    let userId: number | undefined;
    let projectId: number | undefined;

    try {
      const user = await prisma.user.create({
        data: {
          name: 'Integration Test Owner',
          email: `owner-${randomUUID()}@example.test`,
        },
      });
      userId = user.id;

      const project = await prisma.project.create({
        data: {
          name: 'Project With Invalid Assignee Test',
          ownerId: user.id,
        },
      });
      projectId = project.id;

      const assignee = await prisma.user.findUnique({
        where: { id: -1 },
      });

      expect(assignee).toBeNull();

      await expect(
        prisma.task.create({
          data: {
            title: 'Task With Invalid Assignee',
            status: 'todo',
            priority: 'high',
            projectId: project.id,
            assigneeId: -1,
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2003',
      });
    } finally {
      if (projectId !== undefined) {
        await prisma.task.deleteMany({
          where: { projectId },
        });

        await prisma.project.delete({
          where: { id: projectId },
        });
      }

      if (userId !== undefined) {
        await prisma.user.delete({
          where: { id: userId },
        });
      }
    }
  });

  it('rejects a user with a duplicate email', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    const email = `unique-${randomUUID()}@example.test`;

    try {
      await prisma.user.create({
        data: {
          name: 'Original User',
          email,
        },
      });

      await expect(
        prisma.user.create({
          data: {
            name: 'Duplicate User',
            email,
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
      });

      const count = await prisma.user.count({
        where: { email },
      });

      expect(count).toBe(1);
    } finally {
      await prisma.user.deleteMany({
        where: { email },
      });
    }
  });

  it('updates a task in PostgreSQL', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    let userId: number | undefined;
    let projectId: number | undefined;

    try {
      const user = await prisma.user.create({
        data: {
          name: 'Update Test Owner',
          email: `update-owner-${randomUUID()}@example.test`,
        },
      });
      userId = user.id;

      const project = await prisma.project.create({
        data: {
          name: 'Update Test Project',
          ownerId: user.id,
        },
      });
      projectId = project.id;

      const task = await prisma.task.create({
        data: {
          title: 'Original Task',
          status: 'todo',
          priority: 'high',
          projectId: project.id,
        },
      });

      const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: {
          title: 'Updated Task',
          status: 'done',
        },
      });

      const savedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      expect(updatedTask.id).toBe(task.id);
      expect(savedTask).toMatchObject({
        id: task.id,
        title: 'Updated Task',
        status: 'done',
      });
    } finally {
      if (projectId !== undefined) {
        await prisma.task.deleteMany({
          where: { projectId },
        });

        await prisma.project.delete({
          where: { id: projectId },
        });
      }

      if (userId !== undefined) {
        await prisma.user.delete({
          where: { id: userId },
        });
      }
    }
  });

  it('deletes a task from PostgreSQL', async () => {
    if (!prisma) {
      throw new Error('Prisma connection was not initialized');
    }

    let userId: number | undefined;
    let projectId: number | undefined;

    try {
      const user = await prisma.user.create({
        data: {
          name: 'Delete Test Owner',
          email: `delete-owner-${randomUUID()}@example.test`,
        },
      });
      userId = user.id;

      const project = await prisma.project.create({
        data: {
          name: 'Delete Test Project',
          ownerId: user.id,
        },
      });
      projectId = project.id;

      const task = await prisma.task.create({
        data: {
          title: 'Task To Delete',
          status: 'todo',
          priority: 'high',
          projectId: project.id,
        },
      });

      const deletedTask = await prisma.task.delete({
        where: { id: task.id },
      });

      expect(deletedTask.id).toBe(task.id);

      const savedTask = await prisma.task.findUnique({
        where: { id: task.id },
      });

      expect(savedTask).toBeNull();
    } finally {
      if (projectId !== undefined) {
        await prisma.task.deleteMany({
          where: { projectId },
        });

        await prisma.project.delete({
          where: { id: projectId },
        });
      }

      if (userId !== undefined) {
        await prisma.user.delete({
          where: { id: userId },
        });
      }
    }
  });
});
