import { NotFoundException } from '@nestjs/common';
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
