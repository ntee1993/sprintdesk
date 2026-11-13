import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { lockProject } from '../src/prisma/project-lock.js';
import { TaskCommentsService } from '../src/tasks/task-comments.service.js';

describe('Task comments PostgreSQL', () => {
  let prisma: PrismaService;
  let comments: TaskCommentsService;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55439' ||
      url.pathname !== '/sprintdesk_phase2_test'
    )
      throw new Error('Unsafe test database');
    prisma = new PrismaService();
    await prisma.$connect();
    const rows = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    if (rows[0]?.name !== 'sprintdesk_phase2_test')
      throw new Error('Unexpected database');
    comments = new TaskCommentsService(prisma);
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function fixture() {
    const prefix = randomUUID();
    const users = await Promise.all(
      ['owner', 'viewer', 'other'].map((name) =>
        prisma.user.create({
          data: { name, email: `${name}-${prefix}@example.test` },
        }),
      ),
    );
    const [owner, viewer, other] = users;
    const project = await prisma.project.create({
      data: { name: 'Comment test', ownerId: owner.id },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: viewer.id, role: 'VIEWER' },
    });
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title: 'Task',
        status: 'todo',
        priority: 'high',
      },
    });
    return {
      owner,
      viewer,
      other,
      project,
      task,
      cleanup: async () => {
        await prisma.task.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.user.deleteMany({
          where: { id: { in: users.map((user) => user.id) } },
        });
      },
    };
  }

  it('permits viewer comments and restricts reads and modifications by membership and author', async () => {
    const f = await fixture();
    try {
      const created = await comments.create(f.task.id, f.viewer.id, 'Hello');
      expect(created).toMatchObject({
        taskId: f.task.id,
        authorId: f.viewer.id,
        author: { id: f.viewer.id, name: 'viewer' },
      });
      expect(Object.keys(created.author).sort()).toEqual(['id', 'name']);
      expect(await comments.findAll(f.task.id, f.owner.id)).toHaveLength(1);
      expect(await comments.findAll(f.task.id, f.viewer.id)).toHaveLength(1);
      await expect(
        comments.findAll(f.task.id, f.other.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        comments.create(f.task.id, f.other.id, 'No access'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        comments.update(f.task.id, created.id, f.owner.id, 'Not mine'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        comments.remove(f.task.id, created.id, f.owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        (await comments.update(f.task.id, created.id, f.viewer.id, 'Edited'))
          .content,
      ).toBe('Edited');
      await expect(
        comments.update(
          f.task.id + 999999,
          created.id,
          f.viewer.id,
          'Wrong task',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await comments.remove(f.task.id, created.id, f.viewer.id);
      expect(
        await prisma.taskComment.findUnique({ where: { id: created.id } }),
      ).toBeNull();
    } finally {
      await f.cleanup();
    }
  });

  it('rejects the original author after project access is revoked', async () => {
    const f = await fixture();
    try {
      const created = await comments.create(f.task.id, f.viewer.id, 'Original');
      await prisma.projectMember.delete({
        where: {
          projectId_userId: { projectId: f.project.id, userId: f.viewer.id },
        },
      });
      await expect(
        comments.update(f.task.id, created.id, f.viewer.id, 'Changed'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        comments.remove(f.task.id, created.id, f.viewer.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        (await prisma.taskComment.findUnique({ where: { id: created.id } }))
          ?.content,
      ).toBe('Original');
    } finally {
      await f.cleanup();
    }
  });

  it('rejects a comment after membership removal commits while it waits for the project lock', async () => {
    const f = await fixture();
    try {
      let signalLocked!: () => void;
      let release!: () => void;
      const locked = new Promise<void>((resolve) => {
        signalLocked = resolve;
      });
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const removal = prisma.$transaction(
        async (tx) => {
          await lockProject(tx, f.project.id);
          await tx.projectMember.delete({
            where: {
              projectId_userId: { projectId: f.project.id, userId: f.viewer.id },
            },
          });
          signalLocked();
          await hold;
        },
        { timeout: 10000 },
      );
      let observed: Promise<unknown> | undefined;
      try {
        await Promise.race([
          locked,
          removal.then(() => {
            throw new Error('Removal finished before acquiring the lock');
          }),
        ]);
        const write = comments.create(f.task.id, f.viewer.id, 'Late');
        observed = write.then(
          () => null,
          (error: unknown) => error,
        );
        const deadline = Date.now() + 3000;
        let blocked = false;
        while (Date.now() < deadline) {
          const rows = await prisma.$queryRaw<
            { count: bigint }[]
          >`SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%' AND cardinality(pg_blocking_pids(pid)) > 0`;
          if (Number(rows[0]?.count) > 0) {
            blocked = true;
            break;
          }
          await delay(25);
        }
        expect(blocked).toBe(true);
      } finally {
        release();
        try {
          await removal;
        } finally {
          await observed;
        }
      }
      expect(await observed).toBeInstanceOf(NotFoundException);
      expect(
        await prisma.taskComment.count({ where: { taskId: f.task.id } }),
      ).toBe(0);
    } finally {
      await f.cleanup();
    }
  });
});
