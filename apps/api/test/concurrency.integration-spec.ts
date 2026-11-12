import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ProjectAuthorizationService } from '../src/auth/project-authorization.service.js';
import { ProjectsService } from '../src/projects/projects.service.js';
import { TasksService } from '../src/tasks/tasks.service.js';
import { lockProject } from '../src/prisma/project-lock.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('project mutation concurrency', () => {
  let prisma: PrismaService;
  let tasks: TasksService;
  let projects: ProjectsService;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    if (
      url.hostname !== '127.0.0.1' ||
      url.port !== '55439' ||
      url.pathname !== '/sprintdesk_phase2_test'
    )
      throw new Error('Unsafe concurrency test database');
    prisma = new PrismaService();
    await prisma.$connect();
    const identity = await prisma.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    if (identity[0]?.name !== 'sprintdesk_phase2_test')
      throw new Error('Unexpected database');
    tasks = new TasksService(prisma);
    projects = new ProjectsService(
      prisma,
      new ProjectAuthorizationService(prisma),
    );
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function fixture() {
    const suffix = randomUUID();
    const owner = await prisma.user.create({
      data: { name: 'Owner', email: `owner-${suffix}@example.test` },
    });
    const editor = await prisma.user.create({
      data: { name: 'Editor', email: `editor-${suffix}@example.test` },
    });
    const project = await prisma.project.create({
      data: { name: 'Concurrency test', ownerId: owner.id },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: editor.id, role: 'EDITOR' },
    });
    return {
      owner,
      editor,
      project,
      cleanup: async () => {
        await prisma.task.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } });
        await prisma.user.deleteMany({
          where: { id: { in: [owner.id, editor.id] } },
        });
      },
    };
  }
  async function waitForBlockedProjectLock(expected = 1) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const blocked = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
          AND query LIKE '%FOR UPDATE%' AND cardinality(pg_blocking_pids(pid)) > 0
      `;
      if (Number(blocked[0]?.count) >= expected) return;
    }
    throw new Error('Task write did not block on project lock');
  }
  const input = (projectId: number, assigneeId?: number) => ({
    title: 'Concurrent',
    status: 'todo',
    priority: 'high',
    projectId,
    assigneeId,
  });

  for (const change of ['remove', 'downgrade'] as const) {
    it(`rejects editor creation after ${change} commits while holding the project lock`, async () => {
      const f = await fixture();
      try {
        const locked = deferred(),
          release = deferred();
        const revocation = prisma.$transaction(async (tx) => {
          await lockProject(tx, f.project.id);
          if (change === 'remove')
            await tx.projectMember.delete({
              where: {
                projectId_userId: {
                  projectId: f.project.id,
                  userId: f.editor.id,
                },
              },
            });
          else
            await tx.projectMember.update({
              where: {
                projectId_userId: {
                  projectId: f.project.id,
                  userId: f.editor.id,
                },
              },
              data: { role: 'VIEWER' },
            });
          locked.resolve();
          await release.promise;
        });
        await locked.promise;
        const write = tasks.create(input(f.project.id), f.editor.id);
        const observed = write.then(
          () => null,
          (error: unknown) => error,
        );
        try {
          await waitForBlockedProjectLock();
        } finally {
          release.resolve();
        }
        await revocation;
        expect(await observed).toBeInstanceOf(ForbiddenException);
        expect(
          await prisma.task.count({ where: { projectId: f.project.id } }),
        ).toBe(0);
      } finally {
        await f.cleanup();
      }
    });
  }
  for (const operation of ['create', 'update'] as const) {
    it(`rejects ${operation} assignment after member removal commits`, async () => {
      const f = await fixture();
      try {
        const existing = await prisma.task.create({
          data: input(f.project.id),
        });
        const locked = deferred(),
          release = deferred();
        const removal = prisma.$transaction(async (tx) => {
          await lockProject(tx, f.project.id);
          await tx.projectMember.delete({
            where: {
              projectId_userId: {
                projectId: f.project.id,
                userId: f.editor.id,
              },
            },
          });
          await tx.task.updateMany({
            where: { projectId: f.project.id, assigneeId: f.editor.id },
            data: { assigneeId: null },
          });
          locked.resolve();
          await release.promise;
        });
        await locked.promise;
        const write =
          operation === 'create'
            ? tasks.create(input(f.project.id, f.editor.id), f.owner.id)
            : tasks.update(
                existing.id,
                { assigneeId: f.editor.id },
                f.owner.id,
              );
        const observed = write.then(
          () => null,
          (error: unknown) => error,
        );
        try {
          await waitForBlockedProjectLock();
        } finally {
          release.resolve();
        }
        await removal;
        expect(await observed).toBeInstanceOf(BadRequestException);
        expect(
          await prisma.task.count({
            where: { projectId: f.project.id, assigneeId: f.editor.id },
          }),
        ).toBe(0);
      } finally {
        await f.cleanup();
      }
    });
  }
  for (const operation of ['update', 'delete'] as const) {
    it(`rejects ${operation} after editor is downgraded while waiting for the lock`, async () => {
      const f = await fixture();
      try {
        const task = await prisma.task.create({ data: input(f.project.id) });
        const locked = deferred();
        const release = deferred();
        const downgrade = prisma.$transaction(async (tx) => {
          await lockProject(tx, f.project.id);
          await tx.projectMember.update({
            where: {
              projectId_userId: {
                projectId: f.project.id,
                userId: f.editor.id,
              },
            },
            data: { role: 'VIEWER' },
          });
          locked.resolve();
          await release.promise;
        });
        await locked.promise;
        const write =
          operation === 'update'
            ? tasks.update(task.id, { title: 'Changed' }, f.editor.id)
            : tasks.remove(task.id, f.editor.id);
        const observed = write.then(
          () => null,
          (error: unknown) => error,
        );
        try {
          await waitForBlockedProjectLock();
        } finally {
          release.resolve();
        }
        await downgrade;
        expect(await observed).toBeInstanceOf(NotFoundException);
        const saved = await prisma.task.findUnique({ where: { id: task.id } });
        expect(saved).toMatchObject({ id: task.id, title: task.title });
      } finally {
        await f.cleanup();
      }
    });
  }
  it('serializes a task write ahead of a concurrent member removal', async () => {
    const f = await fixture();
    try {
      const locked = deferred(),
        release = deferred();
      const gate = prisma.$transaction(async (tx) => {
        await lockProject(tx, f.project.id);
        locked.resolve();
        await release.promise;
      });
      await locked.promise;
      const write = tasks.create(input(f.project.id, f.editor.id), f.editor.id);
      await waitForBlockedProjectLock();
      const removal = projects.removeMember(
        f.project.id,
        f.editor.id,
        f.owner.id,
      );
      try {
        await waitForBlockedProjectLock(2);
      } finally {
        release.resolve();
      }
      await gate;
      const created = await write;
      await removal;
      expect(
        (await prisma.task.findUnique({ where: { id: created.id } }))
          ?.assigneeId,
      ).toBeNull();
      expect(
        await prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: f.project.id, userId: f.editor.id },
          },
        }),
      ).toBeNull();
    } finally {
      await f.cleanup();
    }
  });
  it('unassigns a previously committed task when removing its member', async () => {
    const f = await fixture();
    try {
      const task = await tasks.create(
        input(f.project.id, f.editor.id),
        f.editor.id,
      );
      await projects.removeMember(f.project.id, f.editor.id, f.owner.id);
      expect(
        (await prisma.task.findUnique({ where: { id: task.id } }))?.assigneeId,
      ).toBeNull();
      expect(
        await prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: f.project.id, userId: f.editor.id },
          },
        }),
      ).toBeNull();
    } finally {
      await f.cleanup();
    }
  });
  it('rolls back removal and unassignment when the transaction fails', async () => {
    const f = await fixture();
    try {
      const task = await tasks.create(
        input(f.project.id, f.editor.id),
        f.owner.id,
      );
      await expect(
        prisma.$transaction(async (tx) => {
          await lockProject(tx, f.project.id);
          await tx.projectMember.delete({
            where: {
              projectId_userId: {
                projectId: f.project.id,
                userId: f.editor.id,
              },
            },
          });
          await tx.task.updateMany({
            where: { projectId: f.project.id, assigneeId: f.editor.id },
            data: { assigneeId: null },
          });
          throw new Error('forced rollback');
        }),
      ).rejects.toThrow('forced rollback');
      expect(
        (await prisma.task.findUnique({ where: { id: task.id } }))?.assigneeId,
      ).toBe(f.editor.id);
      expect(
        await prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId: f.project.id, userId: f.editor.id },
          },
        }),
      ).not.toBeNull();
    } finally {
      await f.cleanup();
    }
  });
});
