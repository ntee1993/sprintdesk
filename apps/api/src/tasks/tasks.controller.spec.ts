import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

describe('TasksController', () => {
  let tasksController: TasksController;
  const tasksService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    }).compile();

    tasksController = moduleRef.get<TasksController>(TasksController);
  });

  describe('findAll', () => {
    it('should return the tasks from the service', () => {
      const tasks = [
        {
          id: 1,
          title: 'Learn NestJS',
          status: 'todo',
          priority: 'high',
          projectId: 1,
        },
      ];
      tasksService.findAll.mockReturnValue(tasks);

      const result = tasksController.findAll();

      expect(tasksService.findAll).toHaveBeenCalledOnce();
      expect(result).toEqual(tasks);
    });
  });

  describe('findOne', () => {
    it('should return the task with ID 1', () => {
      const tasks = {
        id: 1,
        title: 'Learn NestJS',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      };
      tasksService.findOne.mockReturnValue(tasks);

      const result = tasksController.findOne(1);

      expect(tasksService.findOne).toHaveBeenCalledExactlyOnceWith(1);
      expect(result).toEqual(tasks);
    });
  });

  describe('create', () => {
    it('should pass the input to the service and return the created task', () => {
      const input = {
        title: 'Learn Dependency Injection',
        status: 'todo',
        priority: 'high',
        projectId: 1,
      };
      const createdTask = { id: 3, ...input };
      tasksService.create.mockReturnValue(createdTask);

      const result = tasksController.create(input);

      expect(tasksService.create).toHaveBeenCalledExactlyOnceWith(input);
      expect(result).toEqual(createdTask);
    });
  });

  describe('update', () => {
    it('should update correctly', () => {
      const updatedTask = {
        id: 1,
        title: 'Learn NestJS',
        status: 'done',
        priority: 'high',
        projectId: 1,
      };
      tasksService.update.mockReturnValue(updatedTask);
      const result = tasksController.update(1, { status: 'done' });

      expect(tasksService.update).toHaveBeenCalledExactlyOnceWith(1, {
        status: 'done',
      });
      expect(result).toEqual(updatedTask);
    });
  });

  describe('remove', () => {
    it('should delete correctly', () => {
      const deletedTask = {
        id: 1,
        title: 'Learn NestJS',
        status: 'done',
        priority: 'high',
        projectId: 1,
      };
      tasksService.remove.mockReturnValue(deletedTask);
      const result = tasksController.remove(1);

      expect(result).toEqual(deletedTask);
      expect(tasksService.remove).toHaveBeenCalledExactlyOnceWith(1);
    });
  });
});
