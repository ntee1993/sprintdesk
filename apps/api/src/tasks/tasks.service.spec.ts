import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  let tasksService: TasksService;
  let findManyMock: ReturnType<typeof vi.fn>;
  let findFirstMock: ReturnType<typeof vi.fn>;
  let createMock: ReturnType<typeof vi.fn>;
  let updateManyAndReturnMock: ReturnType<typeof vi.fn>;
  let deleteManyMock: ReturnType<typeof vi.fn>;

  const userId = 1;
  const readableProjectFilter = {
    project: {
      is: {
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
    },
  };
  const writableProjectFilter = {
    project: {
      is: {
        OR: [
          { ownerId: userId },
          { memberships: { some: { userId, role: 'EDITOR' } } },
        ],
      },
    },
  };
  const task = {
    id: 1,
    title: 'Learn NestJS',
    status: 'todo',
    priority: 'high',
    projectId: 1,
  };
  const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    { code: 'P2003', clientVersion: '7.10.1' },
  );

  beforeEach(async () => {
    findManyMock = vi.fn().mockResolvedValue([task]);
    findFirstMock = vi.fn().mockResolvedValue(task);
    createMock = vi.fn().mockResolvedValue({ ...task, id: 3 });
    updateManyAndReturnMock = vi
      .fn()
      .mockResolvedValue([{ ...task, status: 'done' }]);
    deleteManyMock = vi.fn().mockResolvedValue({ count: 1 });

    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }]),
      project: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
      task: {
        findFirst: findFirstMock,
        create: createMock,
        updateManyAndReturn: updateManyAndReturnMock,
        deleteMany: deleteManyMock,
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: (fn: (tx: typeof tx) => unknown) => fn(tx),
            project: { findFirst: vi.fn().mockResolvedValue({ id: 1 }) },
            task: {
              findMany: findManyMock,
              findFirst: findFirstMock,
              create: createMock,
              updateManyAndReturn: updateManyAndReturnMock,
              deleteMany: deleteManyMock,
            },
          },
        },
      ],
    }).compile();

    tasksService = module.get<TasksService>(TasksService);
  });

  describe('findAll', () => {
    it('filters tasks to projects the user owns or belongs to', async () => {
      await tasksService.findAll({}, userId);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('returns only tasks from the authorized query', async () => {
      const tasks = await tasksService.findAll({}, userId);

      expect(tasks).toEqual([task]);
    });

    it('filters by status', async () => {
      await tasksService.findAll({ status: 'done' }, userId);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: undefined,
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('filters by priority', async () => {
      await tasksService.findAll({ priority: 'high' }, userId);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: 'high',
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('filters by status and priority', async () => {
      await tasksService.findAll({ status: 'done', priority: 'high' }, userId);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: 'high',
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('paginates an authorized query', async () => {
      await tasksService.findAll({ page: 2, limit: 5 }, userId);

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 5,
        take: 5,
        orderBy: { id: 'asc' },
      });
    });

    it('filters, paginates, and sorts an authorized query', async () => {
      await tasksService.findAll(
        { status: 'done', page: 2, limit: 5, sortBy: 'title', order: 'desc' },
        userId,
      );

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: undefined,
          projectId: undefined,
          ...readableProjectFilter,
        },
        skip: 5,
        take: 5,
        orderBy: { title: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('reads a task only through the project permission filter', async () => {
      await expect(tasksService.findOne(1, userId)).resolves.toEqual(task);

      expect(findFirstMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1, ...readableProjectFilter },
      });
    });

    it('hides tasks that are missing or inaccessible', async () => {
      findFirstMock.mockResolvedValueOnce(null);

      await expect(tasksService.findOne(999, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const newTask = {
      title: 'Learn Dependency Injection',
      status: 'todo',
      priority: 'high',
      projectId: 1,
    };

    it('creates the task data supplied by the authorized controller', async () => {
      createMock.mockResolvedValueOnce({ id: 3, ...newTask });

      await expect(tasksService.create(newTask, userId)).resolves.toEqual({
        id: 3,
        ...newTask,
      });
      expect(createMock).toHaveBeenCalledExactlyOnceWith({ data: newTask });
    });

    it('maps invalid task relations to BadRequestException', async () => {
      createMock.mockRejectedValueOnce(foreignKeyError);

      await expect(tasksService.create(newTask, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates only a task in a project the user may edit', async () => {
      await expect(
        tasksService.update(1, { status: 'done' }, userId),
      ).resolves.toEqual({ ...task, status: 'done' });

      expect(updateManyAndReturnMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1, ...writableProjectFilter },
        data: { status: 'done' },
      });
    });

    it('returns not found when no editable task matches', async () => {
      updateManyAndReturnMock.mockResolvedValueOnce([]);

      await expect(
        tasksService.update(999, { status: 'done' }, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('maps invalid update relations to BadRequestException', async () => {
      updateManyAndReturnMock.mockRejectedValueOnce(foreignKeyError);

      await expect(
        tasksService.update(1, { assigneeId: 999999 }, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes only a task in a project the user may edit', async () => {
      await expect(tasksService.remove(1, userId)).resolves.toEqual(task);

      const where = { id: 1, ...writableProjectFilter };
      expect(findFirstMock).toHaveBeenCalledWith({ where });
      expect(deleteManyMock).toHaveBeenCalledExactlyOnceWith({ where });
    });

    it('returns not found when no editable task matches', async () => {
      findFirstMock.mockResolvedValueOnce(null);

      await expect(tasksService.remove(999, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(deleteManyMock).not.toHaveBeenCalled();
    });
  });
});
