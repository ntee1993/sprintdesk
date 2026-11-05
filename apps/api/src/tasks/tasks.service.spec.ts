import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';

describe('TasksService', () => {
  let tasksService: TasksService;
  let findManyMock: ReturnType<typeof vi.fn>;
  let findUniqueMock: ReturnType<typeof vi.fn>;
  let createMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;
  let deleteMock: ReturnType<typeof vi.fn>;

  const prismaError = new Prisma.PrismaClientKnownRequestError(
    'Record not found',
    {
      code: 'P2025',
      clientVersion: '7.10.1',
    },
  );

  const foreignKeyError = new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    {
      code: 'P2003',
      clientVersion: '7.10.1',
    },
  );

  beforeEach(async () => {
    findManyMock = vi.fn().mockResolvedValue([
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
        projectId: 1,
      },
    ]);

    findUniqueMock = vi.fn().mockImplementation(({ where }) => {
      if (where.id === 1) {
        return Promise.resolve({
          id: 1,
          title: 'Learn NestJS',
          status: 'todo',
          priority: 'high',
          projectId: 1,
        });
      }

      return Promise.resolve(null);
    });

    createMock = vi.fn().mockResolvedValue({
      id: 3,
      title: 'Learn Dependency Injection',
      status: 'todo',
      priority: 'high',
      projectId: 1,
    });

    updateMock = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Learn NestJS',
      status: 'done',
      priority: 'high',
      projectId: 1,
    });

    deleteMock = vi.fn().mockResolvedValue({
      id: 1,
      title: 'Learn NestJS',
      status: 'todo',
      priority: 'high',
      projectId: 1,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: {
            task: {
              findMany: findManyMock,
              findUnique: findUniqueMock,
              create: createMock,
              update: updateMock,
              delete: deleteMock,
            },
          },
        },
      ],
    }).compile();

    tasksService = module.get<TasksService>(TasksService);
  });

  describe('findAll', () => {
    it('should return the initial tasks', async () => {
      const tasks = await tasksService.findAll();

      expect(findManyMock).toHaveBeenCalledOnce();
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      });
    });

    it('should filter by status', async () => {
      await tasksService.findAll({ status: 'done' });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter by priority', async () => {
      await tasksService.findAll({ priority: 'high' });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: 'high',
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter by status and priority', async () => {
      await tasksService.findAll({
        status: 'done',
        priority: 'high',
      });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: 'high',
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should use default pagination', async () => {
      await tasksService.findAll({});

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should paginate to page 2', async () => {
      await tasksService.findAll({ page: 2, limit: 5 });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 5,
        take: 5,
        orderBy: { id: 'asc' },
      });
    });

    it('should filter and paginate tasks', async () => {
      await tasksService.findAll({
        status: 'done',
        page: 3,
        limit: 10,
      });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: undefined,
        },
        skip: 20,
        take: 10,
        orderBy: { id: 'asc' },
      });
    });

    it('should sort tasks by ID descending', async () => {
      await tasksService.findAll({
        sortBy: 'id',
        order: 'desc',
      });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { id: 'desc' },
      });
    });

    it('should sort tasks by title ascending by default', async () => {
      await tasksService.findAll({
        sortBy: 'title',
      });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: undefined,
          priority: undefined,
        },
        skip: 0,
        take: 10,
        orderBy: { title: 'asc' },
      });
    });

    it('should filter, paginate, and sort tasks', async () => {
      await tasksService.findAll({
        status: 'done',
        page: 2,
        limit: 5,
        sortBy: 'title',
        order: 'desc',
      });

      expect(findManyMock).toHaveBeenCalledExactlyOnceWith({
        where: {
          status: 'done',
          priority: undefined,
        },
        skip: 5,
        take: 5,
        orderBy: { title: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return the task with ID 1', async () => {
      const task = {
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      };
      const result = await tasksService.findOne(task.id);

      expect(result).toEqual(task);
    });
    it('should throw NotFoundException when task is not found', async () => {
      await expect(tasksService.findOne(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const newTask = {
      priority: 'high',
      status: 'todo',
      title: 'Learn Dependency Injection',
      projectId: 1,
    };

    it('should add the new task with an ID', async () => {
      const result = await tasksService.create(newTask);
      expect(result).toEqual({
        id: 3,
        ...newTask,
      });

      expect(createMock).toHaveBeenCalledExactlyOnceWith({
        data: newTask,
      });
    });

    it('should assign distinct IDs to consecutive tasks', async () => {
      createMock
        .mockResolvedValueOnce({ id: 3, ...newTask })
        .mockResolvedValueOnce({ id: 4, ...newTask });

      const first = await tasksService.create(newTask);
      const second = await tasksService.create(newTask);

      expect(first.id).toBe(3);
      expect(second.id).toBe(4);

      expect(createMock).toHaveBeenCalledTimes(2);
    });

    it('should create a task and assign to user ID 1', async () => {
      const newTask = {
        title: 'Learn Prisma Relations',
        status: 'todo',
        priority: 'high',
        projectId: 1,
        assigneeId: 1,
      };

      const createdTask = {
        id: 5,
        ...newTask,
      };

      createMock.mockResolvedValueOnce(createdTask);

      const result = await tasksService.create(newTask);

      expect(result).toEqual(createdTask);

      expect(createMock).toHaveBeenCalledExactlyOnceWith({
        data: newTask,
      });
    });

    it('should reject with P2003 error', async () => {
      createMock.mockRejectedValueOnce(foreignKeyError);
      await expect(
        tasksService.create({
          title: 'Invalid Assignment',
          status: 'todo',
          priority: 'high',
          projectId: 1,
          assigneeId: 999999,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update status: "done" without changing other fields', async () => {
      const result = await tasksService.update(1, { status: 'done' });

      expect(result).toEqual({
        id: 1,
        title: 'Learn NestJS',
        status: 'done',
        priority: 'high',
        projectId: 1,
      });
      expect(updateMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
        data: { status: 'done' },
      });
    });

    it('should reject with P2025 error', async () => {
      updateMock.mockRejectedValueOnce(prismaError);
      await expect(
        tasksService.update(999, { status: 'done' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject any error not P2025', async () => {
      const databaseError = new Error('Database unavailable');
      updateMock.mockRejectedValueOnce(databaseError);
      await expect(
        tasksService.update(999, { status: 'done' }),
      ).rejects.toThrow(databaseError);
    });

    it('should reject with P2003 error', async () => {
      updateMock.mockRejectedValueOnce(foreignKeyError);
      await expect(
        tasksService.update(1, { assigneeId: 999999 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete the right task', async () => {
      const result = await tasksService.remove(1);

      expect(result).toEqual({
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      });
      expect(deleteMock).toHaveBeenCalledExactlyOnceWith({
        where: { id: 1 },
      });
    });

    it('should reject with P2025 error', async () => {
      deleteMock.mockRejectedValueOnce(prismaError);
      await expect(tasksService.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should reject any error not P2025', async () => {
      const databaseError = new Error('Database unavailable');
      deleteMock.mockRejectedValueOnce(databaseError);
      await expect(tasksService.remove(999)).rejects.toThrow(databaseError);
    });
  });
});
